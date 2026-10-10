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
      `<div class="alert info" style="margin:6px 0">Haritada <b>parkın içine tıkla</b> ��� sınır ve ad otomatik algılanır. `+
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
  if(DG_PARK)return 3;
  if(DG_PARK_CAND)return 2;
  return 1;
}

function dgScanPreviewName(){
  const el=$("scanNamePreview");
  const inp=$("scanLabel");
  if(!el||!inp)return;
  const park=DG_PARK||DG_PARK_CAND;
  el.textContent=dgProjectName((park&&park.name)||"",inp.value||"");
}

function dgManualFormHTML(open){
  const pt=DG_MANUAL_PENDING||DG_PARK_ANCHOR||(GPS?{lat:GPS.latitude,lon:GPS.longitude}:null);
  return `<div id="manualParkBox" style="display:${open?"block":"none"};margin-top:12px;border-top:1px solid var(--line);padding-top:12px">`+
    `<div class="lbl">ELLE PARK OLUŞTUR</div>`+
    `<div class="alert info" style="margin:6px 0;font-size:.8rem">OSM'de park sınırı yoksa buradan kimlik aç. `+
    `Nokta: <b class="mono">${pt&&Number.isFinite(+pt.lat)?(+pt.lat).toFixed(5)+", "+(+pt.lon).toFixed(5):"haritada parkın içine tıkla veya GPS'i aç"}</b></div>`+
    `<div class="grid g2" style="gap:8px">`+
      `<div><div class="lbl">PARK ADI</div><input id="manualParkName" class="dg-png-input" placeholder="örn. Göksu Parkı"></div>`+
      `<div><div class="lbl">ALAN (HA, opsiyonel)</div><input id="manualParkArea" class="dg-png-input" type="number" step="0.1" placeholder="örn. 42.5"></div>`+
    `</div>`+
    `<button class="btn sm amber" style="margin-top:10px" onclick="dgCreateManualPark()">✓ Parkı Oluştur</button>`+
  `</div>`;
}

function dgShowManualParkForm(){
  const box=$("manualParkBox");
  if(box&&box.style){box.style.display="block";return;}
  DG_MANUAL_PENDING=DG_MANUAL_PENDING||DG_PARK_ANCHOR||(GPS?{lat:GPS.latitude,lon:GPS.longitude}:null);
  dgRenderScanCard(true);
}

function dgToggleParkModeFromScan(){
  if(typeof toggleParkMode==="function")toggleParkMode();
  dgRenderScanCard();
}

function dgCancelScan(){
  DG_PARK_SCAN=false;
  DG_PARK_TARGET_PROJ=null;
  const back=DG_PARK_RETURN_TO;
  DG_PARK_RETURN_TO=null;
  dgRenderScanCard();
  if(back&&typeof go==="function")go(back);
}

/* DB kaydı başarısız olduysa (çevrimdışı/RLS) yeniden dene. */
async function dgRetryRegister(){
  if(!DG_PARK_CAND)return toast("Önce park algıla","err","🌳");
  const row=await dgRegisterPark(DG_PARK_CAND,{});
  if(row){
    DG_PARK=row;
    dgRenderScanCard();
    toast(dgCf("✓ Park kimliği yazıldı: ")+esc(row.name),"ok","🌳");
    if(typeof dgPresenceAct==="function"){try{dgPresenceAct("park",row.name);}catch(e){}}
  }
}

/* Panel başlığındaki kimlik çipi: park DB'de mi, hangi anahtarla? */
function dgParkIdChip(parkRow){
  if(!parkRow){
    return `<span class="dg-png-badge" style="background:rgba(220,38,38,.12);color:#b91c1c" title="Park kimliği sunucuya yazılamadı">⚠ kimlik yok</span>`;
  }
  const src=parkRow.source==="manual"?"elle":(parkRow.source==="backfill"?"geri doldurma":"OSM");
  return `<span class="dg-png-badge" title="${esc(parkRow.osm_key||"")}">kimlik #${parkRow.id} · ${esc(src)}</span>`;
}

/* Paneldeki "Proje oluştur / bağla" düğmesi: algılama kartının 3. adımına götürür. */
function dgShowProjectStep(){
  DG_PARK_SCAN=true;
  dgRenderScanCard();
  const card=$("parkScanCard");
  if(card&&card.scrollIntoView)card.scrollIntoView({behavior:"smooth",block:"start"});
}

/* =========================================================
   6. PROJE OLUŞTUR / BAĞLA
========================================================= */

const DG_PARK_PROJECT_STORE=window.DG_PARK_PROJECT_STORE_ADAPTER.create({getClient:()=>sb});
const DG_PARK_CREATE_PROJECT_USE_CASE=window.DG_PARK_CREATE_PROJECT_APPLICATION.create({
  getUser:()=>USER,
  getPark:()=>DG_PARK,
  getLabel:()=>{const el=$("scanLabel");return el?String(el.value||"").trim():"";},
  projectName:dgProjectName,
  insertProject:row=>DG_PARK_PROJECT_STORE.insert(row),
  persistGeometry:park=>typeof dgPersistParkGeom==="function"?dgPersistParkGeom(park):undefined
});
const DG_PARK_PROJECT_LINK_STORE=window.DG_PARK_PROJECT_LINK_STORE_ADAPTER.create({getClient:()=>sb});
const DG_PARK_LINK_PROJECT_USE_CASE=window.DG_PARK_LINK_PROJECT_APPLICATION.create({
  isAdmin:dgIsAdmin,
  getPark:()=>DG_PARK,
  getProject:pid=>(PROJ_LIST||[]).find(p=>p.id===pid)||null,
  getLabel:()=>{const el=$("scanLabel");return el?String(el.value||""):null;},
  labelFromLegacy:dgLabelFromLegacy,
  updateProject:(pid,patch)=>DG_PARK_PROJECT_LINK_STORE.updateProject(pid,patch),
  backfillMeasurements:(pid,parkId)=>DG_PARK_PROJECT_LINK_STORE.backfillMeasurements(pid,parkId)
});

async function dgScanCreateProject(){
  const result=await DG_PARK_CREATE_PROJECT_USE_CASE();
  if(result.status==="unauthenticated")return toast("Oturum yok","err");
  if(result.status==="park-missing")return toast("Park kimliği sunucuya yazılmadan proje oluşturulamaz. 🔄 ile yeniden dene.","err","🌳");
  if(result.status==="write-failed")return toast(dgCf("Proje oluşturulamadı: ")+esc(result.error.message),"err");
  const data=result.data;
  toast(dgCf("✓ Proje hazır: ")+esc(data.name),"ok","📁");
  await dgAfterProjectLinked(data);
  return data;
}



async function dgLinkProject(pid){
  const result=await DG_PARK_LINK_PROJECT_USE_CASE(pid);
  if(result.status==="forbidden"){
    toast("⛔ Mevcut projeyi parka bağlama yetkisi yalnız yöneticide. Yeni proje için park algılayabilirsin.","err","🔐");
    return null;
  }
  if(result.status==="park-missing")return toast("Önce park algıla","err","🌳");
  if(result.status==="project-missing")return toast("Proje bulunamadı","err");
  if(result.status==="write-failed")return toast(dgCf("Bağlanamadı: ")+esc(result.error.message),"err");
  toast("✓ "+esc(result.data.name)+" → "+esc(result.park.name),"ok","🔗");
  await dgAfterProjectLinked(result.data);
  return result.data;
}

async function dgAfterProjectLinked(proj){
  if(typeof loadProjects==="function")await loadProjects();

  const sel=$("mProject");
  if(sel&&proj){
    sel.value=String(proj.id);
    if(typeof dgParkGate==="function")dgParkGate();
  }
  const nsel=$("nProject");
  if(nsel&&proj)nsel.value=String(proj.id);

  const back=DG_PARK_RETURN_TO;
  DG_PARK_SCAN=false;
  DG_PARK_TARGET_PROJ=null;
  DG_PARK_RETURN_TO=null;
  dgRenderScanCard();
  if(back&&typeof go==="function")go(back);
}

/* =========================================================
   7. ÖLÇÜM KAPISI (v-measure)
========================================================= */

function dgSelectedProject(){
  const sel=$("mProject");
  const pid=sel?+sel.value:0;
  if(!pid)return null;
  return (PROJ_LIST||[]).find(p=>p.id===pid)||null;
}

/* Ölçüm sekmesine OTOMATİK yönlendirme proje başına bir kez yapılır.
 * Sebep: kullanıcı "Yeni Ölçüm"e her tıkladığında haritaya fırlatılırsa
 * ölçüm sekmesine hiç ulaşamaz (kapan); ikinci denemede banner'ı okuyup
 * ne yapacağına kendisi karar verir. */
function dgScanRedirectedOnce(pid){
  const key="dg_park_scan_"+pid;
  try{
    if(sessionStorage.getItem(key))return true;
    sessionStorage.setItem(key,"1");
    return false;
  }catch(e){return true;}   /* gizli mod: yönlendirme döngüsüne girme */
}

/* Ölçüm ekranının üstündeki kapı kartı. saveMeas() da aynı kontrolü yapar —
 * kart yalnız görsel geri bildirim değil, butonu gerçekten kilitler.
 * Sunucu tarafı garanti: trg_enforce_park_link (PARK_REQUIRED).
 * auto=true (sekme açılışı) → parksız projede kullanıcı doğrudan park
 * algılama ekranına götürülür ("ölçüm yapılacağı zaman direkt park algılama
 * ekranına yönlendirsin"). */
function dgParkGate(auto){
  const box=$("parkGate");
  const save=$("saveBtn");

  /* Şema eski: park_id sütunu yok, kapı uygulanamaz. Ölçümü KİLİTLEMEK
   * kullanıcıyı tamamen çalışamaz hâle getirirdi; onun yerine uyarı gösterip
   * eski akışa izin veriyoruz (karşılaştırma da proje bazlı yedeğe düşer). */
  if(!DG_PARK_SCHEMA_OK){
    if(box){box.style.display="block";box.className="alert warn";box.innerHTML=dgSchemaWarnHTML();}
    if(save)save.disabled=false;
    return true;
  }

  const p=dgSelectedProject();

  /* Düzenleme modu: mevcut kaydı güncellemek yeni ölçüm değildir, kilitleme. */
  const editing=typeof EDIT_ID!=="undefined"&&EDIT_ID;

  if(!box)return !!(p&&p.park_id);

  if(editing){
    box.style.display="none";
    if(save)save.disabled=false;
    return true;
  }

  if(!p){
    box.style.display="block";
    box.className="alert err";
    box.innerHTML=
      `<b>⛔ Ölçüm için park algılanmış bir proje gerekli.</b><br>`+
      `<span style="font-size:.82rem">Park algılama ekranına git → parkı seç → proje adı otomatik `+
      `"<b>Göksu Parkı - deneme</b>" biçiminde oluşsun.</span>`+
      `<div style="margin-top:10px"><button class="btn sm blue" onclick="startParkScan({returnTo:'measure'})">🌳 Park Algılama Ekranına Git</button></div>`;
    if(save)save.disabled=true;
    if(auto===true&&!dgScanRedirectedOnce(0))startParkScan({returnTo:"measure"});
    return false;
  }

  if(!p.park_id){
    box.style.display="block";
    box.className="alert err";
    /* Yönetici: projeyi parka bağlayabilir. Normal kullanıcı: bağlama yetkisi
     * yok (0006 → PARK_ADMIN_ONLY), o yüzden yalnız "yeni proje" yolu gösterilir. */
    box.innerHTML=dgIsAdmin()
      ? `<b>⛔ Bu projede park algılanmadı — ölçüm girilemez.</b><br>`+
        `<span style="font-size:.82rem">Proje: <b>${esc(p.name)}</b>. `+
        `Park kimliği olmadan girilen ölçümler karşılaştırmada park bazında izlenemez; `+
        `bu yüzden önce park kimliği oluşturuluyor.</span>`+
        `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">`+
          `<button class="btn sm blue" onclick="go('admin')">🔐 Yönetim → Park Kimlikleri</button>`+
        `</div>`
      : `<b>⛔ Bu proje parka bağlı değil — ölçüm girilemez.</b><br>`+
        `<span style="font-size:.82rem">Proje: <b>${esc(p.name)}</b>. Mevcut projeyi parka bağlama yetkisi `+
        `<b>yalnız yöneticide</b> 🔐. İki yol: (1) yönetici park atamasını Yönetim → Park Kimlikleri'nden yapsın, `+
        `(2) aşağıdan park algılayıp <b>yeni proje</b> aç ve ölçümlere orada devam et.</span>`+
        `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">`+
          `<button class="btn sm blue" onclick="startParkScan({returnTo:'measure'})">🌳 Park Algıla → Yeni Proje Oluştur</button>`+
        `</div>`;
    if(save)save.disabled=true;
    /* ⭐ Otomatik yönlendirme: ölçüme geçmeye çalışan kullanıcı parkı
     * algılamadan forma ulaşamaz (proje başına bir kez). */
    if(auto===true&&!dgScanRedirectedOnce(p.id))startParkScan({projectId:p.id,returnTo:"measure"});
    return false;
  }

  const parkName=p.parks&&p.parks.name?p.parks.name:(p.park_name||"Park");
  box.style.display="block";
  box.className="alert ok";
  box.innerHTML=
    `<div class="measure-park-summary"><span><b>🌳 ${esc(parkName)}</b>`+
    (p.parks&&p.parks.area_m2?` · ${dgFmtHa(p.parks.area_m2)}`:``)+
    `</span><button class="btn sm ghost" onclick="startParkScan({projectId:${p.id},returnTo:'measure'})">Parkı değiştir</button></div>`;
  if(save)save.disabled=false;
  return true;
}

/* Proje seçimi değişti (v-measure). shell.html'deki onchange bunu çağırır. */
function dgProjectChanged(){
 /* 0045: seçim cihaz belleğine yazılır (yenilemede geri gelir). */
 if(typeof dgProjectRemember==="function"){try{dgProjectRemember($("mProject").value);}catch(e){}}
 /* 0036 (T5): proje değişince canlı konum kanalı yeni parka taşınır. */
 if(typeof dgLiveShareJoinCurrent==="function"){try{dgLiveShareJoinCurrent();}catch(e){}}
  dgParkGate();
  if(typeof manualPoint!=="undefined"&&!manualPoint&&!EDIT_ID&&typeof autoFillPointId==="function"){
    $("mPoint").value="";
    $("pointQueryResult").style.display="none";
    autoFillPointId();
  }
}

/* Proje listesi seçeneği: parkı olan 🌳, olmayan ⛔ ile işaretlenir. */
function dgProjectOptionLabel(p){
  if(!p)return "";
  return p.park_id?p.name:"⛔ "+p.name+" (park yok)";
}

/* Grid panelindeki proje seçimi yalnız bu parkın projelerini gösterir:
 * grid/waypoint yanlışlıkla başka parka yazılmasın. */
function dgProjectOptionsForPark(parkId,fallbackAll){
  const list=PROJ_LIST||[];
  const mine=parkId?list.filter(p=>p.park_id===parkId):[];
  if(mine.length){
    return mine.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  }
  if(fallbackAll&&list.length){
    return list.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  }
  return `<option value="0">Bu park için proje yok — algılama kartından oluştur</option>`;
}

/* =========================================================
   8. YÖNETİM: PARKLARI GERİ DOLDUR (eski projeler)
========================================================= */

/* Park bağı olmayan projeleri ölçümlerinin merkezinden parkla eşleştirir.
 * İKİ FAZLI: önce plan çıkarır + önizleme gösterir (hiçbir şey yazmaz),
 * yönetici onaylayınca dgApplyBackfill() yazar. Sebep: bu araç proje ADLARINI
 * da değiştirir ("Göksu Parkı - <eski ad>"); sürpriz olmasın.
 *
 * 2026-09-24 İYİLEŞTİRME (kullanıcı geri bildirimi: "otomatik geri doldurma
 * çalışmadı, sadece Göksu'yu algılayabildim"):
 *   · üç kademeli arama: 1500 m → 3500 m → ADA GÖRE OSM araması
 *     (Dikmen Vadisi gibi, merkez noktası polygon dışında kalan ya da
 *     OSM'de farklı etiketlenmiş yerler için)
 *   · canlı ilerleme (kaçıncı proje, hangi ad) — 6 proje ~20 sn sürer,
 *     eskiden kutu sabit durunca "çalışmıyor" sanılıyordu
 *   · hiç eşleşmeyen proje için satırda "✍️ Elle park kimliği aç":
 *     ölçüm merkezinde, proje adıyla manuel park kimliği açar. Böylece
 *     OSM'de park olmayan yerler de park bazlı karşılaştırmaya girer. */
const dgSleep=ms=>new Promise(r=>setTimeout(r,ms));

async function dgQueryParkSafe(lat,lon,radius){
  try{
    return await queryPark(lat,lon,radius);
  }catch(e){
    console.warn("DENDROGEO · park sorgusu ("+radius+" m) başarısız:",e);
    return null;
  }
}

/* Ada göre OSM araması: proje adının anlamlı sözcükleriyle leisure=park|garden|…
 * elemanlarını 5 km yarıçapta arar. queryPark'ın "merkez noktası polygon
 * içinde mi" varsayımına bağlı değildir. */
async function dgQueryParkByName(lat,lon,projName){
  const words=dgNormParkLoose(projName).split(" ").filter(w=>w.length>2);
  if(!words.length||typeof overpassRequest!=="function")return null;
  const re=words.join("|").replace(/["\\]/g,"");
  if(!re)return null;
  const leisure="park|garden|nature_reserve|common|recreation_ground";
  const q=
    `[out:json][timeout:35];(`+
    `way["leisure"~"${leisure}"]["name"~"${re}",i](around:5000,${lat},${lon});`+
    `relation["leisure"~"${leisure}"]["name"~"${re}",i](around:5000,${lat},${lon});`+
    `way["landuse"~"recreation_ground|meadow|grass"]["name"~"${re}",i](around:5000,${lat},${lon});`+
    `);out geom;`;
  let json=null;
  try{json=await overpassRequest(q,"park adıyla");}catch(e){return null;}
  if(!json||!json.elements||!json.elements.length)return null;

  const cands=[];
  for(const el of json.elements){
    if(typeof extractRings!=="function")break;
    const rings=extractRings(el);
    if(!rings)continue;
    const area=(typeof polyArea==="function")?polyArea(rings):null;
    cands.push({rings,name:(el.tags&&el.tags.name)||null,area,type:el.type,id:el.id});
  }
  if(!cands.length)return null;
  cands.sort((a,b)=>(b.area||0)-(a.area||0));
  return cands;
}

async function dgDetectParkForProject(lat,lon,projName){
  let c=await dgQueryParkSafe(lat,lon,1500);
  if(c&&c.length)return{cands:c,yol:"1500 m"};
  await dgSleep(2100);
  c=await dgQueryParkSafe(lat,lon,3500);
  if(c&&c.length)return{cands:c,yol:"3500 m"};
  await dgSleep(2100);
  c=await dgQueryParkByName(lat,lon,projName);
  if(c&&c.length)return{cands:c,yol:"ad araması"};
  return{cands:null,yol:"bulunamadı"};
}

function dgBackfillProgress(i,n,label){
  const box=$("backfillBox");
  if(!box)return;
  const pct=Math.round((i/n)*100);
  box.style.display="block";
  box.innerHTML=
    `<div class="alert info" style="margin:6px 0">⏳ Park geri doldurma · <b>${i+1}/${n}</b> · ${esc(label)}<br>`+
    `<span style="font-size:.78rem">Her proje için ölçüm merkezi hesaplanıp OSM'de park aranıyor `+
    `(1500 m → 3500 m → ad araması). Overpass nezaketi için ~2 sn arayla.</span></div>`+
    `<div style="height:8px;background:var(--line);border-radius:5px;overflow:hidden">`+
    `<div style="height:100%;width:${pct}%;background:var(--green);transition:width .3s"></div></div>`;
}

async function backfillParks(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const box=$("backfillBox");

  if(!navigator.onLine){
    if(box){box.style.display="block";box.innerHTML=`<div class="alert err">⛔ Park geri doldurma internet gerektirir (OSM/Overpass sorgusu).</div>`;}
    return toast("Çevrimdışı: park geri doldurma çalışmaz.","err","📴");
  }

  const{data:projs,error}=await sb.from("projects").select("id,name,owner,park_id,park_name,label,city,country");
  if(error){
    if(box){box.style.display="block";box.innerHTML=`<div class="alert err">⚠ Projeler okunamadı: <span class="mono">${esc(error.message)}</span></div>`;}
    return toast(dgCf("Projeler okunamadı: ")+esc(error.message),"err");
  }
  const targets=(projs||[]).filter(p=>!p.park_id);

  if(!targets.length){
    if(box){box.style.display="block";box.innerHTML=`<div class="alert ok">✓ Park bağı eksik proje yok — hepsi bir parka bağlı.</div>`;}
    return toast("Park bağı eksik proje yok ✓","ok","🌳");
  }

  dgBackfillProgress(0,targets.length,targets[0].name);

  const plan=[];
  for(let i=0;i<targets.length;i++){
    const p=targets[i];
    dgBackfillProgress(i,targets.length,p.name);

    const{data:m}=await sb.from("measurements").select("lat,lon").eq("project_id",p.id).limit(1000);
    const pts=(m||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
    if(!pts.length){
      plan.push({project:p,durum:"ölçüm yok",park:null,cand:null,lat:null,lon:null});
      continue;
    }
    const lat=pts.reduce((a,r)=>a+ +r.lat,0)/pts.length;
    const lon=pts.reduce((a,r)=>a+ +r.lon,0)/pts.length;

    const found=await dgDetectParkForProject(lat,lon,p.name);
    await dgSleep(2100);

    if(!found.cands||!found.cands.length){
      plan.push({project:p,durum:"OSM'de park yok",park:null,cand:null,lat,lon,n:pts.length});
      continue;
    }
    const c=found.cands[0];
    /* OSM elemanında ad yoksa "İsimsiz Park" yerine proje adından öneri:
     * canlıda iki park "İsimsiz Park" olarak kalmıştı, karşılaştırmada
     * anlamsız satır üretiyordu. */
    const parkName=c.name||dgSuggestParkName(p.name);
    plan.push({
      project:p,durum:"eşleşti",yol:found.yol,cand:c,lat,lon,n:pts.length,
      parkName,
      adsiz:!c.name,
      newName:dgProjectName(parkName,dgLabelFromLegacy(p.name,parkName))
    });
  }

  DG_BACKFILL_PLAN=plan;
  dgRenderBackfillPlan();
}

function dgRenderBackfillPlan(){
  const box=$("backfillBox");
  if(!box)return;
  const plan=DG_BACKFILL_PLAN||[];
  const ok=plan.filter(x=>x.durum==="eşleşti");
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

  const projByPark={},measByPark={};
  (projects||[]).forEach(p=>{if(p.park_id)projByPark[p.park_id]=(projByPark[p.park_id]||0)+1;});
  (measurements||[]).forEach(m=>{if(m.park_id)measByPark[m.park_id]=(measByPark[m.park_id]||0)+1;});
  DG_PARK_ADMIN_LAST={projects:projects||[],measurements:measurements||[]};

  /* BOŞ PARK FİLTRESİ (2026-09-27 · kullanıcı): "her park sorgulamada buraya
   * yazıyor; projeye kayıt yapıldıktan sonra buraya düşsün, boşlar düşmesin."
   * Park kimliği algılamada yazılmaya DEVAM eder (kimlik bütünlüğü ve çit
   * için gerekli) ama yönetim LİSTESİ varsayılan olarak yalnızca projesi
   * VEYA kaydı olan parkları gösterir; boşlar sayaçlı düğmeyle açılır
   * (veri silinmez, yalnızca görünüm). */
  const dgParkIsEmpty=(p)=>!(projByPark[p.id]>0)&&!(measByPark[p.id]>0);
  const emptyRows=rows.filter(dgParkIsEmpty);
  const shown=rows.filter(p=>!dgParkIsEmpty(p)||DG_PARK_ADMIN_SHOW_EMPTY);

  /* Çift kimlik adayları: aynı (gevşek) adı taşıyan parklar */
  const byName={};
  shown.forEach(p=>{
    const k=dgNormParkLoose(p.name)||("#"+p.id);
    (byName[k]=byName[k]||[]).push(p);
  });
  const dupGroups=Object.values(byName).filter(g=>g.length>1);

  const dupHTML=dupGroups.length
    ? `<div class="alert warn" style="margin-bottom:10px"><b>⚠ ${dupGroups.length} ${_tpr("çift kimlik adayı var")}</b> ${_tpr("— aynı park iki satırda duruyorsa karşılaştırma bölünür.")}`+
      dupGroups.map(g=>{
        const mesafe=(g[0].centroid_lat&&g[1].centroid_lat)
          ? Math.round(hav(+g[0].centroid_lat,+g[0].centroid_lon,+g[1].centroid_lat,+g[1].centroid_lon))
          : null;
        const osmOne=g.find(p=>p.source!=="manual")||g[1];
        const other=g.find(p=>p.id!==osmOne.id)||g[0];
        return `<div style="margin-top:6px;font-size:.82rem">🌳 <b>${esc(g[0].name)}</b>: `+
          g.map(p=>`#${p.id} (${esc(p.osm_key||"?")} · ${dgFmtHa(p.area_m2)} · ${projByPark[p.id]||0} proje · ${measByPark[p.id]||0} kayıt)`).join("  ↔  ")+
          (mesafe!==null?` · aradaki mesafe <b>${mesafe} m</b>`:"")+
          ` <button class="btn sm amber" onclick="dgParkMergeInto(${other.id},${osmOne.id})">🔀 #${other.id} → #${osmOne.id} birleştir</button></div>`;
      }).join("")+`</div>`
    : (rows.length?`<div class="alert ok" style="margin-bottom:10px">✓ Çift kimlik yok — her park tek satırda.</div>`:``);

  /* ⚠ /isimsiz/i kullanılmaz: JS'te i bayrağı ASCII katlar, "İsimsiz" (U+0130)
   * eşleşmez — uyarı sessizce hiç çıkmazdı. dgNormParkName ile aksansız/küçük
   * harfe indirip öyle bakılır (aynı tuzak dgNormParkName'in de varlık sebebi). */
  const unnamed=shown.filter(p=>!p.name||dgNormParkName(p.name).indexOf("isimsiz")===0);
  const unnamedHTML=unnamed.length
    ? `<div class="alert info" style="margin-bottom:10px">ℹ ${unnamed.length} ${_tpr("parkın adı yok (OSM elemanında ad etiketi yoktu):")} `+
      unnamed.map(p=>`#${p.id}`).join(", ")+` ${_tpr("— ✏️ ile ad ver (örn. projenin adı).")}</div>`
    : ``;

  box.innerHTML=dupHTML+unnamedHTML+
    (emptyRows.length
      ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">`+
          `<button class="btn sm ghost" onclick="dgParkAdminToggleEmpty()">`+
          (DG_PARK_ADMIN_SHOW_EMPTY?_tpr("🙈 Boş parkları gizle"):_tprf("🫥 Boş parkları göster ({n})",{n:emptyRows.length}))+`</button>`+
          `<span class="dg-tree-meta">Yalnız sorgulanmış, projesi/kaydı olmayan parklar; temizlemek için gösterip 🗑️ kullan.</span>`+
        `</div>`
      : "")+
    /* dg-cards: 640px altında tablo kart düzenine döner (css/style.css).
     * data-label değerleri mobilde her satırın başlığı olur. */
    `<div class="tblwrap dg-parkadmin-wrap"><table class="dg-cards">`+
    `<thead><tr><th scope='col'>ID</th><th scope='col'>Park Adı</th><th scope='col'>Kimlik</th><th scope='col'>Şehir</th><th scope='col'>Alan</th><th scope='col'>Proje</th><th scope='col'>Kayıt</th><th scope='col'>Kaynak</th><th scope='col'>İşlem</th></tr></thead><tbody>`+
    (shown.map(p=>{
      const others=shown.filter(x=>x.id!==p.id);
      const isDup=dupGroups.some(g=>g.some(x=>x.id===p.id));
      return `<tr${isDup?' class="dg-dup"':''}>`+
        `<td data-label="ID" class="mono">${p.id}</td>`+
        `<td data-label="Park Adı"><b>${esc(p.name)}</b>${isDup?' <span class="badge admin">çift?</span>':""}</td>`+
        `<td data-label="Kimlik" class="mono dg-key">${esc(p.osm_key||"—")}</td>`+
        `<td data-label="Şehir">${esc(p.city||"—")}</td>`+
        `<td data-label="Alan">${dgFmtHa(p.area_m2)}</td>`+
        `<td data-label="Proje">${projByPark[p.id]||0}</td>`+
        `<td data-label="Kayıt">${measByPark[p.id]||0}</td>`+
        `<td data-label="Kaynak">${esc(p.source||"—")}</td>`+
        `<td data-label="İşlem"><div class="dg-act">`+
          `<button class="btn sm blue" onclick="dgParkRename(${p.id})" title="Yeniden adlandır">✏️</button>`+
          `<button class="btn sm ghost" onclick="dgBackfillGeom(${p.id})" title="OSM sınırını geom_json'a yaz → konum çiti tam poligonla çalışır">🛰</button>`+
          `<select id="parkMergeSel${p.id}" class="dg-png-select dg-merge-sel">`+
            `<option value="">→ birleştir…</option>`+
            others.map(o=>`<option value="${o.id}">#${o.id} ${esc(o.name)}</option>`).join("")+
          `</select>`+
          `<button class="btn sm amber" onclick="dgParkMergeFromSelect(${p.id})" title="Bu parkı seçilene taşı">🔀</button>`+
          `<button class="btn sm red" onclick="dgParkDelete(${p.id})" title="Sil">🗑️</button>`+
        `</div></td></tr>`;
    }).join("")||`<tr><td colspan=9>Henüz park kimliği yok — Canlı Harita → 🌳 Park Algılama ile oluştur.</td></tr>`)+
    `</tbody></table></div>`+
    (emptyRows.length&&!DG_PARK_ADMIN_SHOW_EMPTY
      ? `<div class="dg-tree-meta" style="margin-top:8px">🫥 ${emptyRows.length} `+(typeof dgT==="function"?dgT("boş park (projesi/kaydı yok) gizlendi — yalnız sorgulanmışlar."):"boş park (projesi/kaydı yok) gizlendi — yalnız sorgulanmışlar.")+`</div>`:"")+
    `<div class="dg-parkadmin-note">🔀 = bu parkı seçtiğin hedefin içine taşır (projeler + ölçümler + adlar), kaynak kimlik silinir. `+
    `✏️ = adı düzeltir; proje adları otomatik yeniden kurulur ("park - etiket"). 🗑️ = yalnız yanlış kimlikse; bağ kopar, veri silinmez.</div>`;
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

async function dgParkMergeInto(srcId,dstId){
  if(!dgIsAdmin())return toast("🔐 Bu işlem yalnız yöneticiye açık.","err");
  srcId=+srcId;dstId=+dstId;
  if(!srcId||!dstId||srcId===dstId)return toast("Geçersiz birleştirme","err");
  const src=DG_PARK_ADMIN_ROWS.find(x=>x.id===srcId);
  const dst=DG_PARK_ADMIN_ROWS.find(x=>x.id===dstId);
  if(!src||!dst)return toast("Park bulunamadı — 🔄 ile yenile","err");

  if(!confirm(_tprf(
    '"{src}" (#{sid}) → "{dst}" (#{did}) birleştirilsin mi?\n\n· Projeler ve ölçümler hedef parka taşınır\n· Proje adları hedef park adına göre yeniden kurulur\n· Kaynak kimlik (#{sid}) SİLİNİR — geri alınamaz\n\nKarşılaştırma artık TEK "{dst}" satırı gösterir.',
    {src:src.name,sid:srcId,dst:dst.name,did:dstId})))return;

  const{error:e1}=await sb.from("projects").update({park_id:dstId}).eq("park_id",srcId);
  if(e1)return toast(dgCf("Projeler taşınamadı: ")+esc(e1.message),"err");
  const{error:e2}=await sb.from("measurements").update({park_id:dstId}).eq("park_id",srcId);
  if(e2)toast(dgCf("Ölçümler taşınırken hata: ")+esc(e2.message),"warn");
  await dgResyncProjectNames(dstId);
  const{error:e3}=await sb.from("parks").delete().eq("id",srcId);
  if(e3)return toast(_tpr("Kaynak kimlik silinemedi: ")+esc(e3.message),"err");

  DG_PARK_SESSION.clear();
  toast(_tprf("✓ #{a} → #{b} birleştirildi",{a:srcId,b:dstId}),"ok","🔀");
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
 const code=String((err&&(err.code||err.status))||"");
 const msg=String((err&&err.message)||err||"");
 if(/^(42P01|42703|42883)$/.test(code))return true;           /* undefined table/column/function */
 if(/PGRST205|PGRST202/.test(msg)||/PGRST205|PGRST202/.test(code))return true;  /* could not find the table/view */
 return /does not exist|could not find the (table|view)|42P01|42703/i.test(msg);
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
