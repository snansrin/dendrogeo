Warning: truncated output (original token count: 14850)
Total output lines: 1247

"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar. */
const _tpr=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tprf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));

/* DendroGeo · services/park-registry.js — PARK KİMLİĞİ + PROJE BAĞI + ÖLÇÜM KAPISI
 *
 * NEDEN VAR (kullanıcı isteği 2026-09-24):
 *  1) "Park Karşılaştırma — Karbon Performansı" proje adlarını değil ALGILANAN
 *     PARKLARI göstermeli: 3 kişi Göksu Parkı'nda çalıştıysa üç proje satırı
 *     değil, TEK "Göksu Parkı" satırı çıkmalı.  → world.js artık v_park_compare
 *     view'ını okuyor; view park bazında group by yapıyor (0004_parks.sql).
 *  2) Ölçüme geçmeden önce kullanıcı park algılama ekranına yönlendirilmeli.
 *     → startParkScan(): v-map'i açar, park modunu AÇAR, adımı adım adım kartta
 *     gösterir (dgRenderScanCard).
 *  3) Proje adı = park adı + kullanıcının etiketi → "Göksu Parkı - deneme".
 *     Adı DB tarafında trg_compose_project_name kurar; istemci aynı kuralı
 *     dgProjectName() ile önizler (iki taraf aynı string'i üretir).
 *  4) Park algılanmadan ölçüm girilemez. İstemci kapısı: dgParkGate() +
 *     saveMeas() kontrolü. Sunucu kapısı: trg_enforce_park_link (PARK_REQUIRED)
 *     — istemci bypass edilse bile veri girmez.
 *
 * PARK KİMLİĞİ NASIL TEKİLLEŞİYOR?
 *  Canonical anahtar OSM elemanıdır: "way/123456". Aynı parkı kim algılarsa
 *  algılasın `parks` tablosunda AYNI satıra düşer; karşılaştırma böylece
 *  kendiliğinden park bazında toplanır. OSM kimliği farklı ama AD + KONUM'u
 *  aynı olan adaylar (parkın alt poligonu, relation/way ikilisi) da yarıçap
 *  içinde TEK park sayılır — yarıçap park alanıyla büyür, çünkü 40 ha'lık
 *  parkın iki ucundaki tıklamalar 250 m'den uzak düşebilir.
 *  OSM'de hiç yoksa kullanıcı "elle park" oluşturur; anahtar o zaman
 *  "manual/<ad>/<enlem 3 hane>/<boylam 3 hane>" olur (~100 m hücresi).
 *
 * Bağımlılıklar (ÇAĞRI ANINDA global): sb, USER, PROFILE, PROJ_LIST, GPS, map,
 * $, esc, toast, hav, queryPark, drawPark, clearPark, toggleParkMode, go,
 * startGps, loadProjects, reverseGeocode, PARK_CANDS, PARK_MODE, PARK_POLY.
 * YÜKLEME SIRASI: park-query.js'ten sonra (queryPark'ı çağırır),
 * grid-engine.js'ten önce (grid panelindeki proje listesi buradan beslenir). */

/* =========================================================
   1. DURUM
========================================================= */

/* DB'ye yazılmış aktif park satırı (public.parks). null = bu oturumda henüz
 * kimliği kayıtlı bir park yok. */
let DG_PARK=null;

/* queryPark'tan gelen HAM aday (DB kaydı başarısız olsa bile UI gösterir). */
let DG_PARK_CAND=null;

/* Ölçümden yönlendirilmiş "park algılama" akışı mı? (kart bu bayrakla açılır) */
let DG_PARK_SCAN=false;

/* Yönlendirmeye sebep olan proje: algılama bitince bu projeye bağlanacak. */
let DG_PARK_TARGET_PROJ=null;

/* Akış bittiğinde dönülecek sekme ("measure" | null). */
let DG_PARK_RETURN_TO=null;

/* Algılamayı tetikleyen nokta (harita tıklaması / GPS / ölçüm merkezi).
 * Park polygonunun kendisi yerine bu nokta saklanır: parkın temsil noktası
 * olarak kullanıcı nerede duruyorsa orası bilimsel olarak daha anlamlı ve
 * rings koordinat sırası sözleşmesine (bkz. geometry.test.mjs uyarısı) hiç
 * dokunmamış oluyoruz. */
let DG_PARK_ANCHOR=null;

/* osm_key → parks satırı. Aynı oturumda aynı park için tekrar sorgu atılmaz. */
const DG_PARK_SESSION=new Map();

/* OSM'de park bulunamadığında açılan "elle park" formunun bekleyen noktası. */
let DG_MANUAL_PENDING=null;

/* Admin "Parkları Geri Doldur" aracının önizleme planı (yazmadan önce gösterilir). */
let DG_BACKFILL_PLAN=null;

/* 0004_parks.sql uygulanmamışsa (parks tablosu / v_park_compare yok) uygulama
 * çökmesin: park kimliği devre dışı kalır, eski proje bazlı akış yedek olarak
 * çalışır ve kullanıcıya sebebi söylenir. */
let DG_PARK_SCHEMA_OK=true;
let DG_PARK_SCHEMA_WARNED=false;

/* Yönetici mi? (owner/admin) — PARKA BAĞLAMA yetkisi yalnız bunlarda.
 * Sunucu karşılığı: 0006_park_admin_only.sql → trg_enforce_park_admin
 * (PARK_ADMIN_ONLY). İstemci düğmeyi gizler, sunucu kuralı zorlar. */
function dgIsAdmin(){
  return !!(typeof PROFILE!=="undefined"&&PROFILE&&
    (PROFILE.role==="admin"||PROFILE.role==="owner"));
}

/* =========================================================
   2. SAF YARDIMCILAR (DOM/ağ yok — birim testlenebilir)
========================================================= */

const DG_PARK_IDENTITY=window.DG_PARK_IDENTITY;
const DG_PARK_SEP=DG_PARK_IDENTITY.SEPARATOR;
const DG_PARK_MATCH_M=DG_PARK_IDENTITY.BASE_MATCH_RADIUS_M;

/* Klasik script çağrıları için eski API adları korunur. Kuralların sahibi
 * domain/parks/identity.js; bu servis yalnız uyumluluk sarmalayıcılarını verir. */
function dgNormParkName(s){return DG_PARK_IDENTITY.normalizeName(s);}
function dgNormParkLoose(s){return DG_PARK_IDENTITY.normalizeLooseName(s);}
function dgParkKey(type,id){return DG_PARK_IDENTITY.osmKey(type,id);}
function dgManualParkKey(name,lat,lon){return DG_PARK_IDENTITY.manualKey(name,lat,lon);}
function dgProjectName(parkName,label){return DG_PARK_IDENTITY.projectName(parkName,label);}
function dgLabelFromLegacy(name,parkName){return DG_PARK_IDENTITY.labelFromLegacy(name,parkName);}
function dgParkMatchRadius(areaM2){return DG_PARK_IDENTITY.matchRadius(areaM2);}
function dgTitleCaseTR(t){return DG_PARK_IDENTITY.titleCaseTR(t);}
function dgSuggestParkName(projName){return DG_PARK_IDENTITY.suggestName(projName);}
function dgParkCenterFromRings(rings){return DG_PARK_IDENTITY.centerFromRings(rings);}
function dgFmtHa(areaM2){
  const a=Number(areaM2);
  if(!Number.isFinite(a)||a<=0)return "alan bilinmiyor";
  return (a/10000).toFixed(1)+" ha";
}

/* Algılama noktası: anchor (tıklama/GPS) → halka merkezi → null */
function dgParkCenter(cand,opt){
  opt=opt||{};
  if(Number.isFinite(+opt.lat)&&Number.isFinite(+opt.lon)){
    return{lat:+opt.lat,lon:+opt.lon};
  }
  if(DG_PARK_ANCHOR&&Number.isFinite(+DG_PARK_ANCHOR.lat)){
    return{lat:+DG_PARK_ANCHOR.lat,lon:+DG_PARK_ANCHOR.lon};
  }
  return dgParkCenterFromRings(cand&&cand.rings)||{lat:null,lon:null};
}

/* =========================================================
   3. PARK KAYDI (public.parks)
========================================================= */

function dgParkStore(){
  return window.DG_PARK_STORE_ADAPTER.create({client:sb,normalizeLoose:dgNormParkLoose,distance:hav});
}
async function dgSelectParkByKey(key){return dgParkStore().selectByKey(key);}
async function dgSelectParkNear(nameNorm,lat,lon,radiusM){return dgParkStore().selectNear(nameNorm,lat,lon,radiusM);}

/* Supabase, oturum/cache, reverse geocoding ve kullanıcı bildirimlerini
 * uygulama use-case'ine bağlayan eski servis facade'ı. */
const DG_PARK_REGISTER_USE_CASE=window.DG_PARK_REGISTRATION_APPLICATION.create({
  getStore:()=>typeof sb==="undefined"||!sb?null:dgParkStore(),
  getUser:()=>typeof USER==="undefined"?null:USER,
  isEnabled:()=>DG_PARK_SCHEMA_OK,
  session:DG_PARK_SESSION,
  centerFor:dgParkCenter,
  manualKey:dgManualParkKey,
  osmKey:dgParkKey,
  normalizeName:dgNormParkName,
  matchRadius:dgParkMatchRadius,
  getReverseGeocode:()=>typeof reverseGeocode==="function"?reverseGeocode:null,
  notifyManualConflict:hit=>{
    if(typeof toast==="function")toast(dgCf("ℹ Bu park daha önce elle oluşturulmuş (#")+hit.id+")"+_tpr("; aynı kimlik kullanılıyor. OSM kimliğine geçmek için: Yönetim → 🌳 Park Kimlikleri → 🔀 birleştir."),"info","🌳");
  },
  warn:error=>console.warn("DENDROGEO · park kimliği yazılamadı:",error&&error.message),
  notifyWriteFailure:error=>toast(dgCf("Park kimliği sunucuya yazılamadı: ")+esc(error.message),"err","🌳")
});
async function dgRegisterPark(cand,opt){return DG_PARK_REGISTER_USE_CASE(cand,opt);}

/* =========================================================
   4. ALGILAMA AKIŞI (ölçümden yönlendirme dahil)
========================================================= */

/* Belirli bir noktada park ara → bulunduysa çiz, bulunamadıysa elle oluştur
 * teklif et. bindParkClick (harita tıklaması), "konumumdan algıla" ve
 * geri doldurma aracı AYNI yolu kullanır. */
const DG_PARK_DETECT_USE_CASE=window.DG_PARK_DETECTION_APPLICATION.create({
  isOnline:()=>navigator.onLine,
  queryPark:(lat,lon,radius)=>queryPark(lat,lon,radius),
  setAnchor:point=>{DG_PARK_ANCHOR=point;},
  setCandidates:parks=>{PARK_CANDS=parks;},
  offerManual:(lat,lon)=>dgOfferManualPark(lat,lon),
  drawPark:park=>drawPark(park),
  warn:error=>console.warn("DENDROGEO · park sorgusu hatası:",error),
  notify:(kind)=>{
    if(kind==="invalid-location")return toast("Geçersiz konum","err","🌳");
    if(kind==="offline")return toast("Park algılama internet gerektirir (OSM/Overpass).","err","🌳");
    if(kind==="searching")return toast("🌳 Park sorgulanıyor…","info");
    if(kind==="query-failed")return toast(_tpr("OSM bağlantısı başarısız; parkın olmadığı doğrulanamadı. Yeniden algılamayı deneyin."),"err","🌳");
  }
});
async function dgDetectAt(lat,lon,opt){return DG_PARK_DETECT_USE_CASE(lat,lon,opt);}

/* UZAKTAN PARK ARAMA: 1) kayıtlı parklarda ada göre bul (name_norm),
 * 2) yoksa Nominatim'den koordinat → dgDetectAt (aynı boru hattı: queryPark →
 * kimlik → DG_PARK). Konum BİLGİSİ gerektirmez → kullanıcı evden de proje açar. */
const DG_PARK_SEARCH_STORE=window.DG_PARK_SEARCH_ADAPTER.create({getClient:()=>sb,getFetch:()=>fetch});
const DG_PARK_SEARCH_USE_CASE=window.DG_PARK_SEARCH_APPLICATION.create({
  normalizeName:dgNormParkName,
  findRegistered:prefix=>DG_PARK_SEARCH_STORE.findRegistered(prefix),
  geocode:query=>DG_PARK_SEARCH_STORE.geocode(query),
  onEvent:(kind,payload)=>{
    if(kind==="database-error")console.warn("DENDROGEO · uzak park arama (DB):",payload&&payload.message);
    if(kind==="searching-osm")toast("🔍 "+payload+" "+_tpr("OSM'de aranıyor…"),"info","🌳");
  }
});
async function dgScanSearchByName(name){
 const result=await DG_PARK_SEARCH_USE_CASE(name);
 if(result.status==="empty-query")return toast("Önce park adını yaz.","warn","🔍");
 if(result.status==="registered"){
  DG_PARK_CAND=null;DG_PARK=result.park;dgRenderScanCard();
  return toast("🌳 "+esc(result.park.name)+" "+_tpr("seçildi — proje açabilirsin; ölçüm için parkta olman gerekir."),"ok","🌳");
 }
 if(result.status==="not-found")return toast("Bulunamadı: haritada parkın içine tıkla ya da ✍️ elle oluştur.","warn","🔍");
 if(result.status==="geocode-failed")return toast(dgCf("Arama hatası: ")+esc(result.error.message)+" "+_tpr("— haritada tıkla veya elle oluştur."),"err","🔍");
 if(result.status==="geocoded")return await dgDetectAt(+result.point.lat,+result.point.lon);
}

function dgDetectAtMyLocation(){
  if(!GPS){
    toast("Önce 📡 Konumu Etkinleştir","warn","🛰");
    if(typeof startGps==="function")startGps();
    return Promise.resolve(null);
  }
  /* Promise döndürülür: çağıran (test / akış) algılamanın bitişini bekleyebilir. */
  return dgDetectAt(GPS.latitude,GPS.longitude);
}

/* Park bulunamadı → elle park oluşturma formu (OSM'de olmayan parklar için
 * kaçış yolu; yoksa kullanıcı ölçüm giremez hâlde kilitlenirdi). */
const DG_PARK_MANUAL_CREATION_USE_CASE=window.DG_PARK_MANUAL_CREATION_APPLICATION.create({
  getName:()=>{const el=$("manualParkName");return el?String(el.value||""):"";},
  getAreaHectares:()=>{const el=$("manualParkArea");return el?String(el.value||""):"";},
  getLocation:()=>DG_MANUAL_PENDING||DG_PARK_ANCHOR||(typeof GPS!=="undefined"&&GPS?{lat:GPS.latitude,lon:GPS.longitude}:null),
  registerPark:(candidate,opt)=>dgRegisterPark(candidate,opt)
});
function dgOfferManualPark(lat,lon){
  DG_PARK_CAND=null;
  DG_PARK=null;
  DG_PARK_ANCHOR={lat,lon};
  DG_MANUAL_PENDING={lat,lon};
  dgRenderScanCard(true);
  toast("Bu noktada OSM parkı bulunamadı — elle park oluşturabilirsin.","warn","🌳");
}

async function dgCreateManualPark(){
  const result=await DG_PARK_MANUAL_CREATION_USE_CASE();
  if(result.status==="name-required")return toast("Park adı gerekli","err","🌳");
  if(result.status==="location-required")return toast("Konum yok: haritada parkın içine tıkla veya GPS'i aç.","err","📍");
  if(result.status==="registration-failed")return toast("Elle park oluşturulamadı.","err","🌳");
  const row=result.row;

  DG_PARK=row;
  DG_MANUAL_PENDING=null;
  dgRenderScanCard();
  toast(dgCf("✓ Park oluşturuldu: ")+esc(row.name),"ok","🌳");
  return row;
}

/* Ölçüm ekranından gelen yönlendirme: park algılama ekranını aç.
 * opt: {projectId, returnTo} */
function startParkScan(opt){
  opt=opt||{};
  DG_PARK_SCAN=true;
  DG_PARK_TARGET_PROJ=opt.projectId||null;
  DG_PARK_RETURN_TO=opt.returnTo||"measure";

  if(typeof go==="function")go("map");

  /* Park modu kapalıysa AÇ (toggleParkMode kartı da tazeler). */
  if(typeof PARK_MODE!=="undefined"&&!PARK_MODE&&typeof toggleParkMode==="function"){
    toggleParkMode();
  }

  setTimeout(()=>{
    if(map&&map.invalidateSize)map.invalidateSize();
    dgFocusScanTarget();
    dgRenderScanCard();
    const card=$("parkScanCard");
    if(card&&card.scrollIntoView)card.scrollIntoView({behavior:"smooth",block:"start"});
  },200);

  toast("🌳 Park algılama: haritada parkın içine tıkla","info","🌳");
}

/* Hedefe odaklan: bağlanacak projenin ölçümleri → GPS → mevcut görünüm */
async function dgFocusScanTarget(){
  if(!map)return;
  const pid=DG_PARK_TARGET_PROJ;
  if(pid){
    try{
      const{data}=await sb.from("measurements").select("lat,lon").eq("project_id",pid).limit(500);
      const pts=(data||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
      if(pts.length){
        const b=L.latLngBounds(pts.map(r=>[+r.lat,+r.lon]));
        map.fitBounds(b.pad(.4),{maxZoom:17});
        return;
      }
    }catch(e){}
  }
  if(GPS&&Number.isFinite(+GPS.latitude)){
    map.setView([GPS.latitude,GPS.longitude],17);
  }
}

/* =========================================================
   5. ALGILAMA KARTI (v-map üstündeki adım adım akış)
========================================================= */

/* 0040: kaydırma koruma sarmalı. */
function dgRenderScanCard(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgRenderScanCard__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgRenderScanCard__scroll(forceManual){
  const el=$("parkScanCard");
  if(!el||!el.style)return;
  if(document.getElementById("v-map")?.classList.contains("surface-review-active")){el.style.display="none";return;}

  const park=DG_PARK;
  const cand=DG_PARK_CAND;
  const showManual=forceManual===true||!!DG_MANUAL_PENDING;

  if(!DG_PARK_SCAN&&!park&&!cand&&!showManual){
    el.style.display="none";
    el.innerHTML="";
    return;
  }

  el.style.display="block";

  const schemaWarn=dgSchemaWarnHTML();

  /* --- adım göstergesi --- */
  const steps=
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">`+
      `<b style="font-size:1rem">🌳 Park Algılama</b>`+
      `<span class="dg-scan-step${dgScanStep()>=1?" on":""}">1 · Parkı bul</span>`+
      `<span class="dg-scan-step${dgScanStep()>=2?" on":""}">2 · Kimliği doğrula</span>`+
      `<span class="dg-scan-step${dgScanStep()>=3?" on":""}">3 · Proje</span>`+
    `</div>`;

  /* --- 1) park henüz yok --- */
  if(!park&&!cand){
    el.innerHTML=schemaWarn+steps+
      `<div class="alert info" style="margin:6px 0">Haritada <b>parkın içine tıkla</b> — sınır ve ad otomatik algılanır. `+
      `Park modu kapalıysa aşağıdaki buton açar.</div>`+
      `<div style="display:flex;gap:8px;flex-wrap:wrap">`+
        `<button class="btn sm blue" onclick="dgToggleParkModeFromScan()">🌳 Park Modunu Aç</button>`+
        `<button class="btn sm" onclick="dgDetectAtMyLocation()">📍 Konumumdan Algıla</button>`+
      `</div>`+
      /* UZAKTAN PARK (2026-09-27 · kullanıcı isteği): "uzaktaki bir parka proje
       * oluşturamıyorum". GPS yalnızca ÖNERİ içindir; ada göre arama herhangi
       * bir yerdeki parkı bulur → proje açılabilir. ÖLÇÜM kapısı ayrı kalır:
       * saveMeas konum çitiyle parkta olmayı zorunlu tutar. */
      `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">`+
        `<input id="scanRemote" class="dg-png-input" placeholder="uzaktaki parkın adı (örn. Göksu Parkı, Mersin)" style="flex:1;min-width:200px">`+
        `<button class="btn sm blue" onclick="dgScanSearchByName(document.getElementById('scanRemote').value)">🔍 Ada göre bul (uzak park)</button>`+
      `</div>`+
      `<div class="dg-tree-meta" style="margin-top:6px">Uzak parkta <b>proje açabilirsin</b>; ölçüm ve fotoğraf için parkta olman gerekir (konum çiti 0007).</div>`+
      `<div style="display:flex;gap:8px;flex-wrap:wrap">`+
        `<button class="btn sm ghost" onclick="dgShowManualParkForm()">✍️ OSM'de yok — elle oluştur</button>`+
      `</div>`+
      dgManualFormHTML(showManual);
    return;
  }

  /* --- 2) park algılandı: kimlik + proje adımı --- */
  const nm=esc((park&&park.name)||(cand&&cand.name)||"İsimsiz Park");
  const ha=dgFmtHa((park&&park.area_m2)||(cand&&cand.area));
  const ident=park
    ? `DB #${park.id} · ${esc(park.osm_key||"")}`
    : `<span style="color:var(--red)">kimlik sunucuya yazılamadı</span>`;

  /* Parka BAĞLAMA araçları yalnız yöneticiye görünür (0006 + kullanıcı isteği).
   * Normal kullanıcı yalnız "yeni proje oluştur" görür. */
  const admin=dgIsAdmin();
  const target=(admin&&DG_PARK_TARGET_PROJ)
    ? (PROJ_LIST||[]).find(p=>p.id===DG_PARK_TARGET_PROJ)
    : null;

  const others=admin
    ? (PROJ_LIST||[]).filter(p=>!p.park_id&&(!target||p.id!==target.id))
    : [];

  el.innerHTML=schemaWarn+steps+
    `<div class="alert ${park?"ok":"err"}" style="margin:6px 0">`+
      `<b>${nm}</b> · ${ha} · <span class="mono" style="font-size:.72rem">${ident}</span>`+
      (park?`<br><span style="font-size:.78rem">Bu park artık sistemde TEK kimlik: başkaları aynı parkı algıladığında veriler bu satırda birleşir.</span>`
           :`<br><button class="btn sm amber" onclick="dgRetryRegister()">🔄 Kimliği yeniden yaz</button>`)+
    `</div>`+


    `<div class="grid g2" style="gap:10px">`+
      `<div>`+
        `<div class="lbl">PROJE ETİKETİ (opsiyonel)</div>`+
        `<input id="scanLabel" class="dg-png-input" placeholder="örn. deneme" oninput="dgScanPreviewName()" value="${esc(target?dgLabelFromLegacy(target.name,(park&&park.name)||""):"")}">`+
        `<div class="lbl" style="margin-top:8px">PROJE ADI</div>`+
        `<div id="scanNamePreview" class="mono" style="font-size:.85rem;padding:6px 0">${esc(dgProjectName((park&&park.name)||"",target?dgLabelFromLegacy(target.name,park&&park.name):""))}</div>`+
      `</div>`+
      `<div style="display:flex;flex-direction:column;gap:8px;justify-content:center">`+
        `<button class="btn blue" onclick="dgScanCreateProject()">📁 Yeni proje oluştur</button>`+
        (admin
          ? ``
          : `<div class="dg-tree-meta">🔐 Bu ekrandan yalnızca <b>yeni proje</b> açılır. `+
            `Mevcut projelere park atamasını yönetici <b>Yönetim → Park Kimlikleri</b>'nden yapar.</div>`)+
        (DG_PARK_SCAN&&DG_PARK_RETURN_TO
          ? `<button class="btn sm ghost" onclick="dgCancelScan()">Vazgeç</button>`
          : ``)+
      `</div>`+
    `</div>`;
}

function dgScanStep(){
  if(DG_PARK)re…4850 tokens truncated…");
  const noPark=plan.filter(x=>x.durum==="OSM'de park yok");
  const noMeas=plan.filter(x=>x.durum==="ölçüm yok");

  box.style.display="block";
  box.innerHTML=
    `<div class="alert info" style="margin:6px 0">Plan: <b>${ok.length}</b> proje OSM parkıyla eşleşti · `+
    `<b>${noPark.length}</b> projede OSM parkı yok (satırdaki ✍️ ile elle oluştur) · `+
    `<b>${noMeas.length}</b> projede ölçüm yok.</div>`+
    `<div class="tblwrap" style="max-height:340px;overflow:auto"><table>`+
      `<thead><tr><th scope='col'>Proje (eski ad)</th><th scope='col'>Park</th><th scope='col'>Yeni ad</th><th scope='col'>Alan</th><th scope='col'>Nasıl bulundu</th><th scope='col'>Durum / İşlem</th></tr></thead><tbody>`+
      plan.map(x=>{
        const isOk=x.durum==="eşleşti";
        const act=isOk
          ? `<span class="badge on">✓ eşleşecek</span>`
          : (x.lat!=null
            ? `<span class="badge admin">${esc(x.durum)}</span> <button class="btn sm ghost" onclick="dgBackfillManual(${x.project.id})">✍️ Elle park oluştur ve bağla</button>`
            : `<span class="badge off">${esc(x.durum)}</span>`);
        return `<tr>`+
          `<td>${esc(x.project.name)}<br><span class="mono" style="font-size:.66rem;color:var(--mut)">${x.n||0} ölçüm${x.lat!=null?` · ${x.lat.toFixed(5)},${x.lon.toFixed(5)}`:""}</span></td>`+
          `<td>${esc(x.parkName||"—")}</td>`+
          `<td>${esc(x.newName||"—")}</td>`+
          `<td>${x.cand?dgFmtHa(x.cand.area):"—"}</td>`+
          `<td class="mono" style="font-size:.68rem">${esc(x.yol||"—")}</td>`+
          `<td>${act}</td>`+
        `</tr>`;
      }).join("")+
    `</tbody></table></div>`+
    `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">`+
      (ok.length?`<button class="btn amber" onclick="dgApplyBackfill()">${_tprf("✓ Planı Uygula ({n} proje)",{n:ok.length})}</button>`:``)+
      `<button class="btn sm ghost" onclick="dgCloseBackfill()">Kapat</button>`+
    `</div>`+
    (ok.length?``:`<div class="alert warn" style="margin-top:8px">OSM'de eşleşen park çıkmadı. Satırlardaki <b>✍️ Elle park oluştur ve bağla</b> düğmesi, ölçüm merkezinde o proje adıyla bir park kimliği açar — karşılaştırma yine park bazlı çalışır.</div>`);
}

function dgCloseBackfill(){
  const box=$("backfillBox");
  if(box){box.style.display="none";box.innerHTML="";}
  DG_BACKFILL_PLAN=null;
}

async function dgApplyBackfill(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const plan=(DG_BACKFILL_PLAN||[]).filter(x=>x.durum==="eşleşti");
  if(!plan.length)return toast("Uygulanacak eşleşme yok","warn");
  if(!confirm(_tprf("{n} proje parkla eşleşecek ve adları yeniden kurulacak. Devam?",{n:plan.length})))return;

  let ok=0,fail=0;
  for(let i=0;i<plan.length;i++){
    const x=plan[i];
    dgBackfillProgress(i,plan.length,x.project.name+" → bağlanıyor");

    /* Park kimliğini yaz/oku (aynı park birden çok projede geçiyorsa
     * dgRegisterPark aynı satırı döndürür → karşılaştırmada birleşirler).
     * cand.name boşsa önerilen adı taşı (dgRegisterPark adı buradan okur). */
    const cand=Object.assign({},x.cand,{name:x.parkName||(x.cand&&x.cand.name)});
    const park=await dgRegisterPark(cand,{lat:x.lat,lon:x.lon,source:"backfill"});
    if(!park){fail++;continue;}
    if(await dgLinkProjectToPark(x.project,park))ok++;else fail++;
  }

  toast(_tprf("✓ {n} proje parkla eşleştirildi{f}",{n:ok,f:fail?_tprf(" · {n} hata",{n:fail}):""}),fail?"warn":"ok","🌳");
  DG_BACKFILL_PLAN=null;
  dgCloseBackfill();
  dgAfterBackfillWrites();
}

/* Tek proje için ortak bağlama adımları (geri doldurma + elle oluşturma). */
async function dgLinkProjectToPark(proj,park){
  const label=dgLabelFromLegacy(proj.name,park.name);
  const{error}=await sb.from("projects").update({park_id:park.id,label}).eq("id",proj.id);
  if(error){
    console.warn("DENDROGEO · backfill proje hatası:",error.message);
    toast(dgCf("Bağlanamadı (")+esc(proj.name)+"): "+esc(error.message),"err");
    return false;
  }
  /* Ölçümlerin denormalize park_id'sini doldur (view zaten yedekli okur,
   * ama rapor/dışa aktarım tutarlılığı için satır düzeyinde de dursun). */
  try{
    await sb.from("measurements").update({park_id:park.id}).eq("project_id",proj.id).is("park_id",null);
  }catch(e){}
  return true;
}

/* OSM'de park bulunamayan proje: ölçüm merkezinde, proje adıyla MANUEL park
 * kimliği aç ve bağla. Böylece "Ülkü", "Dikmen Vadisi" gibi yerler de park
 * bazlı karşılaştırmaya girer. */
async function dgBackfillManual(projectId){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const x=(DG_BACKFILL_PLAN||[]).find(k=>k.project.id===projectId);
  if(!x||x.lat==null)return toast("Bu proje için ölçüm merkezi yok.","err");
  const name=String(x.project.name||"").trim()||"İsimsiz Park";
  if(!confirm(_tprf('"{name}" adıyla elle park kimliği oluşturulsun ve proje bağlansın mı?\nKonum: ölçümlerin merkezi ({la}, {lo})',{name:name,la:x.lat.toFixed(5),lo:x.lon.toFixed(5)})))return;

  const park=await dgRegisterPark(
    {name,source:"manual",area:null},
    {manual:true,lat:x.lat,lon:x.lon,source:"manual"}
  );
  if(!park)return toast("Park kimliği oluşturulamadı.","err","🌳");

  const done=await dgLinkProjectToPark(x.project,park);
  if(!done)return;

  /* Plan satırını "eşleşti"ye çevir ki liste güncel kalsın */
  x.durum="eşleşti";x.parkName=park.name;x.yol="elle oluşturuldu";
  x.newName=dgProjectName(park.name,dgLabelFromLegacy(x.project.name,park.name));
  x.cand={name:park.name,area:park.area_m2};

  toast("✓ "+esc(park.name)+" oluşturuldu ve bağlandı","ok","🌳");
  dgRenderBackfillPlan();
  dgAfterBackfillWrites();
}

function dgAfterBackfillWrites(){
  if(typeof loadProjects==="function")loadProjects();
  if(typeof loadWorld==="function")loadWorld();
  if(typeof loadAdmin==="function")loadAdmin();
}

/* =========================================================
   8b) YÖNETİM: PARK KİMLİKLERİ (yeniden adlandır · birleştir · sil)
========================================================= */
/* NEDEN VAR (canlı veri 2026-09-24): aynı Göksu Parkı İKİ kimlikle kayıtlıydı
 * (#1 elle "manual/goksu parki/39.972/32.659", #2 OSM "way/423602737"). İki
 * kimlik = karşılaştırmada İKİ ayrı satır, yani tam da istenmeyen bölünme.
 * Ayrıca OSM'de adı olmayan iki poligon "İsimsiz Park" olarak kalmıştı.
 *
 * Otomatik birleştirme BİLEREK yapılmıyor: iki ayrı park aynı adı taşıyabilir
 * ("Cumhuriyet Parkı" ×2). Karar yöneticide; araç yalnız ölçüyü gösterir
 * (ad + mesafe + alan) ve tek tıkla taşır. */
let DG_PARK_ADMIN_ROWS=[];
let DG_PARK_ADMIN_SHOW_EMPTY=false;   /* 2026-09-27: boş parkları göster/gizle */
let DG_PARK_ADMIN_LAST=null;          /* son projects/measurements bağlamı */

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadParkAdmin(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkAdmin__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkAdmin__scroll(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const box=$("parkAdminBox");
  if(box)box.innerHTML='<div class="alert info">⏳ Park kimlikleri yükleniyor…</div>';

  const[pk,pj,mm]=await Promise.all([
    sb.from("parks").select("*").order("name"),
    sb.from("projects").select("id,name,park_id"),
    sb.from("measurements").select("park_id").limit(5000)
  ]);
  if(pk.error){
    if(box)box.innerHTML=`<div class="alert err">⚠ Parklar okunamadı: <span class="mono">${esc(pk.error.message)}</span></div>`;
    return;
  }
  DG_PARK_ADMIN_ROWS=pk.data||[];
  dgRenderParkAdmin(pj.data||[],mm.data||[]);
}

function dgRenderParkAdmin(projects,measurements){
  const box=$("parkAdminBox");
  if(!box)return;
  const rows=DG_PARK_ADMIN_ROWS;

  DG_PARK_ADMIN_LAST={projects:projects||[],measurements:measurements||[]};
  const overview=window.DG_PARK_ADMIN_OVERVIEW.build({
    rows,
    projects,
    measurements,
    showEmpty:DG_PARK_ADMIN_SHOW_EMPTY,
    normalizeLoose:dgNormParkLoose,
    normalizeName:dgNormParkName
  });
  window.DG_PARK_ADMIN_RENDERER.render({
    element:box,
    rows,
    overview,
    showEmpty:DG_PARK_ADMIN_SHOW_EMPTY,
    formatHectares:dgFmtHa,
    distance:hav,
    escapeHTML:esc,
    translate:_tpr,
    translateFormat:_tprf,
    translatePlain:value=>typeof dgT==="function"?dgT(value):value
  });
}

async function dgResyncProjectNames(parkId,knownName){
  /* projects.park_name tazelenince trg_compose_project_name (0004) proje adını
   * park adından YENİDEN kurar — ayrı bir ad yazma kuralı gerekmez.
   * knownName verilirse (yeniden adlandırma) ikinci sorguya gerek yok. */
  let nm=knownName?String(knownName).trim():"";
  if(!nm){
    const{data}=await sb.from("parks").select("name").eq("id",parkId).maybeSingle();
    nm=(data&&data[0]&&data[0].name)||"";
  }
  if(!nm)return;
  await sb.from("projects").update({park_name:nm}).eq("park_id",parkId);
}

async function dgParkRename(id){
  if(!dgIsAdmin())return toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
  const p=DG_PARK_ADMIN_ROWS.find(x=>x.id===id);
  if(!p)return toast("Park bulunamadı","err");
  const nn=prompt(_tpr("Park adı (örn. Göksu Parkı):"),p.name);
  if(nn===null)return;
  const name=String(nn).trim();
  if(!name)return toast("Ad boş olamaz","err");
  const{error}=await sb.from("parks").update({name,name_norm:dgNormParkName(name)}).eq("id",id);
  if(error)return toast(dgCf("Ad güncellenemedi: ")+esc(error.message),"err");
  await dgResyncProjectNames(id,name);
  toast(dgCf("✓ Park adı güncellendi: ")+esc(name)+" "+_tpr("— proje adları yeniden kuruldu"),"ok","🌳");
  await dgAfterParkAdminChange();
}

function dgParkMergeFromSelect(id){
  const sel=$("parkMergeSel"+id);
  const dst=sel?+sel.value:0;
  if(!dst)return toast("Önce hedef park seç","err","🔀");
  dgParkMergeInto(id,dst);
}

const DG_PARK_ADMIN_MERGE=window.DG_PARK_ADMIN_MERGE_APPLICATION.create({
  isAdmin:dgIsAdmin,
  getParks:()=>DG_PARK_ADMIN_ROWS,
  confirmMerge:(src,dst)=>confirm(_tprf(
    '"{src}" (#{sid}) → "{dst}" (#{did}) birleştirilsin mi?\n\n· Projeler ve ölçümler hedef parka taşınır\n· Proje adları hedef park adına göre yeniden kurulur\n· Kaynak kimlik (#{sid}) SİLİNİR — geri alınamaz\n\nKarşılaştırma artık TEK "{dst}" satırı gösterir.',
    {src:src.name,sid:src.id,dst:dst.name,did:dst.id})),
  moveProjects:(srcId,dstId)=>sb.from("projects").update({park_id:dstId}).eq("park_id",srcId),
  moveMeasurements:(srcId,dstId)=>sb.from("measurements").update({park_id:dstId}).eq("park_id",srcId),
  resyncProjectNames:dgResyncProjectNames,
  deletePark:id=>sb.from("parks").delete().eq("id",id),
  clearSession:()=>DG_PARK_SESSION.clear()
});

async function dgParkMergeInto(srcId,dstId){
  const result=await DG_PARK_ADMIN_MERGE(srcId,dstId);
  if(result.status==="forbidden")return toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
  if(result.status==="invalid")return toast("Geçersiz birleştirme","err");
  if(result.status==="park-missing")return toast("Park bulunamadı — 🔄 ile yenile","err");
  if(result.status==="cancelled")return;
  if(result.status==="projects-failed")return toast(dgCf("Projeler taşınamadı: ")+esc(result.error.message),"err");
  if(result.measurementError)toast(dgCf("Ölçümler taşınırken hata: ")+esc(result.measurementError.message),"warn");
  if(result.status==="delete-failed")return toast(_tpr("Kaynak kimlik silinemedi: ")+esc(result.error.message),"err");

  toast(_tprf("✓ #{a} → #{b} birleştirildi",{a:result.sourceId,b:result.destinationId}),"ok","🔀");
  await dgAfterParkAdminChange();
}

async function dgParkDelete(id){
  if(!dgIsAdmin())return toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
  const p=DG_PARK_ADMIN_ROWS.find(x=>x.id===id);
  if(!p)return toast("Park bulunamadı","err");
  if(!confirm(
    `"${p.name}" (#${id}) silinsin mi?\n\n`+
    `· Bağlı projeler park bağını KAYBEDER ("park yok" durumuna düşer, adları değişmez)\n`+
    `· Ölçümlerin park_id'si null olur — ÖLÇÜM SİLİNMEZ\n`+
    `· Yanlış/çift kimlikse silmek yerine 🔀 birleştirmeyi kullan`))return;
  const{error}=await sb.from("parks").delete().eq("id",id);
  if(error)return toast("Silinemedi: "+esc(error.message),"err");
  DG_PARK_SESSION.clear();
  toast("✓ Park kimliği silindi","ok","🗑️");
  await dgAfterParkAdminChange();
}

async function dgAfterParkAdminChange(){
  await loadParkAdmin();
  if(typeof loadProjects==="function")loadProjects();
  if(typeof loadWorld==="function")loadWorld();
  if(typeof loadAdminTree==="function")loadAdminTree();
}

/* =========================================================
   9. TEMİZLİK + KÖPRÜLER
========================================================= */

/* clearPark() park geometrisini sıfırlarken çağrılır: oturumun aktif park
 * kimliği de düşer (proje bağı DB'de kalır, kapı PROJ_LIST'ten okur). */
function dgResetParkIdentity(){
  DG_PARK=null;
  DG_PARK_CAND=null;
  DG_MANUAL_PENDING=null;
  dgRenderScanCard();
}

/* drawPark() bunu bekler: park kimliği DB'ye yazılır, kart tazelenir.
 * park-panel.js çağırır; dönüş değeri paneldeki kimlik çipi için kullanılır. */
async function dgOnParkDrawn(cand){
  DG_PARK_CAND=cand||null;
  let row=null;
  if(cand&&navigator.onLine){
    row=await dgRegisterPark(cand,{});
  }else if(cand){
    toast("Çevrimdışı: park kimliği yazılamıyor. Ölçüm için bağlantı gerek.","warn","📴");
  }
  DG_PARK=row||null;
  dgRenderScanCard();
  return row;
}

/* =========================================================
   10. ŞEMA YEDEĞİ (migration 0004 henüz uygulanmadıysa)
========================================================= */

/* GERÇEK ŞEMA EKSİĞİ Mİ? (2026-09-26)
 * Yetki (42501/401/403), ağ ve zaman aşımı hataları şema eksiği DEĞİLDİR.
 * Bu ayrım yapılmadığında dgParkSchemaMissing DG_PARK_SCHEMA_OK=false
 * yapıyor, ölçüm kapısı (measure.js:278) kapanıyor ve yeni kayıtlar
 * park_id=null yazılıyordu (measure.js:318) — yani GEÇİCİ bir 401 kalıcı
 * veri bütünlüğü kaybına dönüşüyordu. */
function dgIsSchemaError(err){
 return window.DG_PARK_SCHEMA_CAPABILITY.isSchemaError(err);
}

function dgParkSchemaMissing(reason){
 /* YANLIŞ ALARM KAPANDI (2026-09-26): yetki/ağ hatası buraya düşerse şema
  * bayrağı DÜŞÜRÜLMEDEN yalnızca bilgi verilir. Gerçek şema eksiğinde
  * davranış eskisiyle birebir aynı. */
 if(!dgIsSchemaError(reason)){
  console.warn("DENDROGEO · park kimliği okunamadı (şema değil, yetki/ağ):",reason);
  toast("⚠ Park kimliği geçici olarak okunamadı (yetki/ağ). Şema sorunu değil — sayfayı yenileyin.","warn","🌳");
  return;
 }
 if(DG_PARK_SCHEMA_WARNED)return;
 DG_PARK_SCHEMA_WARNED=true;
 DG_PARK_SCHEMA_OK=false;
 console.warn("DENDROGEO · park kimliği şeması eksik:",reason);
 const isAdm=typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner");
 toast(
  isAdm
   ? "⚠ Veritabanı şeması eski — park kimliği çalışmıyor. Supabase SQL Editor'da supabase/migrations/0004_parks.sql çalıştır."
   : "⚠ Park kimliği tabloları kurulmamış; yönetici 0004_parks.sql migration'ını uygulamalı.",
  "warn","🌳");
 dgRenderScanCard();
}

function dgSchemaWarnHTML(){
 return DG_PARK_SCHEMA_OK?"":
  `<div class="alert warn" style="margin:6px 0"><b>⚠ Park kimliği devre dışı:</b> veritabanında `+
  `<span class="mono">public.parks</span> yok. <span class="mono">supabase/migrations/0004_parks.sql</span> `+
  `çalıştırılana kadar karşılaştırma proje adı bazında kalır ve ölçüm kapısı uygulanamaz.</div>`;
}

window.startParkScan=startParkScan;
window.dgDetectAtMyLocation=dgDetectAtMyLocation;
window.dgScanSearchByName=dgScanSearchByName;

/* =========================================================
   🛰 GEOMETRİ BACKFILL (2026-09-27 · denetim P7)
   7 parkın hiçbirinde geom_json yoktu → 0007 konum çiti daire-yedeğiyle
   çalışıyordu. Bu araç OSM sınırını çekip parks.geom_json'a yazar; çit
   bundan sonra TAM POLİGONLA doğrular. Yalnız yönetici düğmesi; yazma
   RLS'e takılır (parks_update: created_by veya admin).
========================================================= */
async function dgFetchOsmRing(osmKey){
  const m=String(osmKey||"").match(/^(way|relation)\/(\d+)$/);
  if(!m)return null;
  const r=await fetch("https://api.openstreetmap.org/api/0.6/"+m[1]+"/"+m[2]+"/full.json",{headers:{"Accept":"application/json"}});
  if(!r.ok)throw new Error("OSM HTTP "+r.status);
  const j=await r.json();
  if(m[1]==="way"){
    const ring=j.elements.filter(e=>e.type==="node").map(n=>[n.lat,n.lon]);
    return ring.length>=4?{outer:[ring],inner:[]}:null;
  }
  const nodes={};for(const e of j.elements)if(e.type==="node")nodes[e.id]=[e.lat,e.lon];
  const ways=j.elements.filter(e=>e.type==="way").map(w=>(w.nodes||[]).map(id=>nodes[id]).filter(Boolean));
  const rings=(typeof joinWaysToRings==="function")?joinWaysToRings(j.elements.filter(e=>e.type==="way")):null;
  if(rings&&rings.length)return{outer:[rings[0]],inner:rings.slice(1)};
  const outer=ways.filter(w=>w.length>3&&w[0][0]===w[w.length-1][0]&&w[0][1]===w[w.length-1][1]).sort((a,b)=>b.length-a.length)[0];
  return outer?{outer:[outer],inner:[]}:null;
}
async function dgBackfillGeom(parkId){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const{data:park}=await sb.from("parks").select("*").eq("id",parkId).maybeSingle();
  if(!park)return toast("Park bulunamadı","err");
  toast("🛰 OSM sınırı çekiliyor…","info","🛰");
  let geom;
  try{geom=await dgFetchOsmRing(park.osm_key);}catch(e){return toast(dgCf("OSM hatası: ")+esc(e.message),"err","🛰");}
  if(!geom)return toast("OSM'de kapalı sınır bulunamadı (relation parçalı olabilir).","warn","🛰");
  const area=typeof polyArea==="function"?polyArea(geom.outer):park.area_m2;
  const{error}=await sb.from("parks").update({geom_json:geom,area_m2:area>0?Math.round(area):park.area_m2}).eq("id",parkId);
  if(error)return toast(dgCf("Yazılamadı (yetki/ağ): ")+esc(error.message),"err","🛰");
  toast("✓ "+esc(park.name)+" geometrisi yazıldı — çit artık tam poligonla.","ok","🛰");
  loadParkAdmin();
}
window.dgBackfillGeom=dgBackfillGeom;
function dgParkAdminToggleEmpty(){
 DG_PARK_ADMIN_SHOW_EMPTY=!DG_PARK_ADMIN_SHOW_EMPTY;
 const ctx=DG_PARK_ADMIN_LAST||{projects:[],measurements:[]};
 dgRenderParkAdmin(ctx.projects,ctx.measurements);
}
window.dgParkAdminToggleEmpty=dgParkAdminToggleEmpty;
window.dgCreateManualPark=dgCreateManualPark;
window.dgShowManualParkForm=dgShowManualParkForm;
window.dgToggleParkModeFromScan=dgToggleParkModeFromScan;
window.dgCancelScan=dgCancelScan;
window.dgShowProjectStep=dgShowProjectStep;
window.dgParkIdChip=dgParkIdChip;
window.dgRetryRegister=dgRetryRegister;
window.dgScanCreateProject=dgScanCreateProject;
window.dgScanPreviewName=dgScanPreviewName;
window.dgParkGate=dgParkGate;
window.dgProjectChanged=dgProjectChanged;
window.backfillParks=backfillParks;
window.dgApplyBackfill=dgApplyBackfill;
window.dgCloseBackfill=dgCloseBackfill;
window.dgBackfillManual=dgBackfillManual;
window.loadParkAdmin=loadParkAdmin;
window.dgParkRename=dgParkRename;
window.dgParkMergeInto=dgParkMergeInto;
window.dgParkMergeFromSelect=dgParkMergeFromSelect;
window.dgParkDelete=dgParkDelete;
window.dgIsAdmin=dgIsAdmin;
