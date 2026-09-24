"use strict";
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

/* Proje adı ayracı — DB trigger'ı (compose_project_name) ile BİREBİR aynı. */
const DG_PARK_SEP=" - ";

/* Ad + konum eşleştirmesinin taban yarıçapı (m). */
const DG_PARK_MATCH_M=250;

/* =========================================================
   2. SAF YARDIMCILAR (DOM/ağ yok — birim testlenebilir)
========================================================= */

const DG_TR_FOLD={
  "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u",
  "â":"a","î":"i","û":"u","é":"e","à":"a","ñ":"n"
};

/* "GÖKSU PARKI" = "goksu parki" = "Göksu  Parkı" → "goksu parki"
 * Türkçe büyük/küçük harf tuzağı bilinçli olarak elle çözülür: JS
 * toLowerCase() "İ" harfini "i̇" (i + birleşen nokta) yapar, bu da
 * eşleştirmeyi sessizce bozar. Önce İ/I → i, sonra küçük harf, sonra aksan. */
function dgNormParkName(s){
  let t=String(s??"").trim();
  if(!t)return "";
  t=t.replace(/[İI]/g,"i").toLowerCase();
  t=t.replace(/[çğıöşüâîûéàñ]/g,c=>DG_TR_FOLD[c]||c);
  t=t.replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  return t;
}

/* Eşleştirme için gevşek biçim: sonda/kökte duran "park/parki" sözcüğünü atar.
 * "Göksu Parkı" ile "Göksu Park" aynı parktır; ad farkı yüzünden ikinci bir
 * kimlik açılmasın diye yalnız YAKIN KONUM kontrolünde kullanılır
 * (osm_key'de kullanılmaz — anahtar her zaman kesin biçimden üretilir). */
function dgNormParkLoose(s){
  return dgNormParkName(s)
    .replace(/\b(park|parki|parklar|parki)\b/g,"")
    .trim()
    .replace(/\s+/g," ");
}

function dgParkKey(type,id){
  const t=String(type||"way").toLowerCase();
  const n=Number(id);
  return t+"/"+(Number.isFinite(n)?String(n):String(id??"").trim());
}

/* Elle oluşturulan park: ad + ~100 m hücresi. Aynı adla 100 m içinde ikinci
 * bir park açılamaz; farklı yerde aynı ad (örn. iki ayrı "Cumhuriyet Parkı")
 * ayrı kimlik olur — doğru davranış. */
function dgManualParkKey(name,lat,lon){
  const a=Number(lat),o=Number(lon);
  const cell=Number.isFinite(a)&&Number.isFinite(o)
    ? a.toFixed(3)+"/"+o.toFixed(3)
    : "yok";
  return "manual/"+(dgNormParkName(name)||"isimsiz")+"/"+cell;
}

/* Proje adı kuralı: park adı + ayrac + etiket. Etiket boşsa yalnız park adı.
 * DB'deki compose_project_name() ile aynı çıktıyı verir (test kilidi var). */
function dgProjectName(parkName,label){
  const p=String(parkName??"").trim();
  const l=String(label??"").trim();
  if(!p)return l;
  return l?p+DG_PARK_SEP+l:p;
}

/* Eski (serbest adlı) projeden etiket çıkar:
 *  "Göksu Parkı - deneme"  → "deneme"
 *  "Göksu Parkı"           → ""        (ad zaten park adı)
 *  "Kuzey Kesim Envanteri" → aynı      (park adıyla ilgisi yok → etiket olur,
 *                                       sonuç: "Göksu Parkı - Kuzey Kesim Envanteri")
 * Geri doldurma aracında kullanılır; eski ad ASLA kaybolmaz. */
function dgLabelFromLegacy(name,parkName){
  const n=String(name??"").trim();
  const p=String(parkName??"").trim();
  if(!p)return n;
  if(n.toLowerCase()===p.toLowerCase())return "";
  if(n.toLowerCase().startsWith(p.toLowerCase())){
    return n.slice(p.length).replace(/^[\s\-–—·:,.]+/,"").trim();
  }
  return n;
}

/* Parkın temsil yarıçapı: alan büyüdükçe eşleştirme yarıçapı da büyür.
 * 40 ha ≈ 630 m × 630 m → yarıçap ~315 m; taban 250 m'nin altında kalmaz. */
function dgParkMatchRadius(areaM2){
  const a=Number(areaM2);
  if(!Number.isFinite(a)||a<=0)return DG_PARK_MATCH_M;
  return Math.max(DG_PARK_MATCH_M,Math.sqrt(a)/2);
}

/* queryPark adayının halkalarından bbox merkezi ([lat,lon] sözleşmesi —
 * extractRings noktaları [lat,lon] üretir). Halka yoksa anchor'a düşer. */
function dgParkCenterFromRings(rings){
  const outer=Array.isArray(rings)
    ? rings
    : (rings&&Array.isArray(rings.outer)?rings.outer:null);
  if(!outer||!outer.length)return null;
  let a0=90,a1=-90,o0=180,o1=-180,n=0;
  outer.forEach(r=>{
    if(!Array.isArray(r))return;
    r.forEach(p=>{
      if(!Array.isArray(p))return;
      const la=Number(p[0]),lo=Number(p[1]);
      if(!Number.isFinite(la)||!Number.isFinite(lo))return;
      if(la<a0)a0=la; if(la>a1)a1=la;
      if(lo<o0)o0=lo; if(lo>o1)o1=lo;
      n++;
    });
  });
  if(!n)return null;
  return{lat:+(((a0+a1)/2).toFixed(6)),lon:+(((o0+o1)/2).toFixed(6))};
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

/* Metre → okunabilir alan */
function dgFmtHa(areaM2){
  const a=Number(areaM2);
  if(!Number.isFinite(a)||a<=0)return "alan bilinmiyor";
  return (a/10000).toFixed(1)+" ha";
}

/* =========================================================
   3. PARK KAYDI (public.parks)
========================================================= */

async function dgSelectParkByKey(key){
  try{
    const{data}=await sb.from("parks").select("*").eq("osm_key",key).limit(1);
    return (data&&data[0])||null;
  }catch(e){return null;}
}

/* Aynı ad (gevşek) + yakın konum → TEK park say. parks_select herkese açık
 * olduğu için bu sorgu yönetici olmayan kullanıcıda da çalışır. */
async function dgSelectParkNear(nameNorm,lat,lon,radiusM){
  if(!Number.isFinite(+lat)||!Number.isFinite(+lon))return null;
  const loose=dgNormParkLoose(nameNorm);
  if(!loose)return null;
  /* Kaba bbox filtresi (1° ≈ 111 km) → adaylar küçük bir küme olur. */
  const dLat=(+radiusM)/111000;
  const dLon=(+radiusM)/(111000*Math.max(.2,Math.cos(lat*Math.PI/180)));
  try{
    const{data}=await sb.from("parks")
      .select("*")
      .gte("centroid_lat",lat-dLat).lte("centroid_lat",lat+dLat)
      .gte("centroid_lon",lon-dLon).lte("centroid_lon",lon+dLon)
      .limit(50);
    const hits=(data||[]).filter(p=>dgNormParkLoose(p.name)===loose);
    if(!hits.length)return null;
    hits.sort((a,b)=>
      hav(lat,lon,+a.centroid_lat,+a.centroid_lon)-
      hav(lat,lon,+b.centroid_lat,+b.centroid_lon));
    const best=hits[0];
    const dist=hav(lat,lon,+best.centroid_lat,+best.centroid_lon);
    return dist<=radiusM?best:null;
  }catch(e){return null;}
}

/* Adayı (OSM veya elle) `parks` tablosuna yazar / mevcut satırı döndürür.
 * RLS NOTU: upsert KULLANMIYORUZ. upsert çakışmada UPDATE'e döner ve
 * parks_update yalnız satır sahibi + yöneticiye açık; ikinci kullanıcı aynı
 * parkı algıladığında RLS'e takılıp 23505 alırdı. Bunun yerine select → yoksa
 * insert → yarışta 23505 gelirse yeniden select. Böylece herkes aynı satırı
 * okur, kimse başkasının satırını yazmak zorunda kalmaz. */
async function dgRegisterPark(cand,opt){
  opt=opt||{};
  if(!USER||!sb)return null;
  /* Şema eski (public.parks yok) → kimlik yazılamaz; ölçüm akışı eski
   * davranışla devam eder (dgParkGate kapıyı devre dışı bırakır). */
  if(!DG_PARK_SCHEMA_OK)return null;

  const rawName=String((cand&&cand.name)||opt.name||"").trim();
  const name=rawName||"İsimsiz Park";
  const manual=opt.manual===true||(cand&&cand.source==="manual");
  const center=dgParkCenter(cand,opt);
  const key=manual
    ? dgManualParkKey(name,center.lat,center.lon)
    : dgParkKey(cand&&cand.type,cand&&cand.id);

  if(DG_PARK_SESSION.has(key))return DG_PARK_SESSION.get(key);

  /* Şehir/ülke: reverseGeocode pahalı (Nominatim ~1 istek/sn), yalnız kayıt
   * gerçekten YENİ ise ve elimizde hiç bilgi yoksa çağrılır. */
  let city=opt.city||null,country=opt.country||null;

  const area=Number(cand&&cand.area);
  const row={
    osm_key:key,
    osm_type:manual?"manual":String((cand&&cand.type)||"way"),
    osm_id:manual?null:(Number(cand&&cand.id)||null),
    name,
    name_norm:dgNormParkName(name),
    country,city,
    centroid_lat:center.lat,
    centroid_lon:center.lon,
    area_m2:Number.isFinite(area)&&area>0?Math.round(area):null,
    source:opt.source||(manual?"manual":"osm"),
    created_by:USER.id
  };

  /* 1) zaten kayıtlı mı? */
  let hit=await dgSelectParkByKey(key);

  /* 2) aynı ad + yakın konum → OSM kimliği farklı olsa da TEK park */
  if(!hit&&Number.isFinite(+center.lat)){
    hit=await dgSelectParkNear(row.name_norm,+center.lat,+center.lon,dgParkMatchRadius(row.area_m2));
  }

  if(hit){
    DG_PARK_SESSION.set(key,hit);
    return hit;
  }

  /* 3) yeni kayıt — şehir/ülke gerekirse burada çözülür */
  if(Number.isFinite(+center.lat)&&(!city||!country)&&typeof reverseGeocode==="function"){
    const geo=await reverseGeocode(+center.lat,+center.lon);
    if(geo){city=geo.city;country=geo.country;row.city=city;row.country=country;}
  }

  const{data,error}=await sb.from("parks").insert(row).select().single();
  if(error){
    if(error.code==="23505"){
      const again=await dgSelectParkByKey(key);
      if(again){DG_PARK_SESSION.set(again.osm_key,again);return again;}
    }
    console.warn("DENDROGEO · park kimliği yazılamadı:",error.message);
    toast("Park kimliği sunucuya yazılamadı: "+esc(error.message),"err","🌳");
    return null;
  }

  DG_PARK_SESSION.set(key,data);
  return data;
}

/* =========================================================
   4. ALGILAMA AKIŞI (ölçümden yönlendirme dahil)
========================================================= */

/* Belirli bir noktada park ara → bulunduysa çiz, bulunamadıysa elle oluştur
 * teklif et. bindParkClick (harita tıklaması), "konumumdan algıla" ve
 * geri doldurma aracı AYNI yolu kullanır. */
async function dgDetectAt(lat,lon,opt){
  opt=opt||{};
  if(!Number.isFinite(+lat)||!Number.isFinite(+lon)){
    return toast("Geçersiz konum","err","🌳");
  }
  if(!navigator.onLine&&!opt.silent){
    return toast("Park algılama internet gerektirir (OSM/Overpass).","err","🌳");
  }
  if(!opt.silent)toast("🌳 Park sorgulanıyor…","info");
  DG_PARK_ANCHOR={lat:+lat,lon:+lon};

  let parks=null;
  try{
    parks=await queryPark(+lat,+lon,opt.radius||1200);
  }catch(e){
    console.warn("DENDROGEO · park sorgusu hatası:",e);
  }

  if(!parks||!parks.length){
    if(opt.silent)return null;
    dgOfferManualPark(+lat,+lon);
    return null;
  }

  PARK_CANDS=parks;
  if(opt.silent)return parks;
  await drawPark(parks[0]);
  return parks;
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
function dgOfferManualPark(lat,lon){
  DG_PARK_CAND=null;
  DG_PARK=null;
  DG_PARK_ANCHOR={lat,lon};
  DG_MANUAL_PENDING={lat,lon};
  dgRenderScanCard(true);
  toast("Bu noktada OSM parkı bulunamadı — elle park oluşturabilirsin.","warn","🌳");
}

async function dgCreateManualPark(){
  const nameEl=$("manualParkName");
  const name=nameEl?String(nameEl.value||"").trim():"";
  if(!name)return toast("Park adı gerekli","err","🌳");
  const pt=DG_MANUAL_PENDING||DG_PARK_ANCHOR||(GPS?{lat:GPS.latitude,lon:GPS.longitude}:null);
  if(!pt||!Number.isFinite(+pt.lat))return toast("Konum yok: haritada parkın içine tıkla veya GPS'i aç.","err","📍");

  const areaEl=$("manualParkArea");
  const ha=areaEl?parseFloat(String(areaEl.value||"").replace(",",".")):NaN;

  const cand={name,source:"manual",area:Number.isFinite(ha)&&ha>0?ha*10000:null};
  const row=await dgRegisterPark(cand,{manual:true,lat:+pt.lat,lon:+pt.lon});
  if(!row)return toast("Elle park oluşturulamadı.","err","🌳");

  DG_PARK=row;
  DG_MANUAL_PENDING=null;
  dgRenderScanCard();
  toast("✓ Park oluşturuldu: "+esc(row.name),"ok","🌳");
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

function dgRenderScanCard(forceManual){
  const el=$("parkScanCard");
  if(!el||!el.style)return;

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

  const target=DG_PARK_TARGET_PROJ
    ? (PROJ_LIST||[]).find(p=>p.id===DG_PARK_TARGET_PROJ)
    : null;

  const others=(PROJ_LIST||[]).filter(p=>!p.park_id&&(!target||p.id!==target.id));

  el.innerHTML=schemaWarn+steps+
    `<div class="alert ${park?"ok":"err"}" style="margin:6px 0">`+
      `<b>${nm}</b> · ${ha} · <span class="mono" style="font-size:.72rem">${ident}</span>`+
      (park?`<br><span style="font-size:.78rem">Bu park artık sistemde TEK kimlik: başkaları aynı parkı algıladığında veriler bu satırda birleşir.</span>`
           :`<br><button class="btn sm amber" onclick="dgRetryRegister()">🔄 Kimliği yeniden yaz</button>`)+
    `</div>`+

    (target
      ? `<div class="alert info" style="margin:6px 0">📁 <b>${esc(target.name)}</b> projesi park bekliyordu. Bağlayınca ölçüm ekranına döneceksin.</div>`
      : ``)+

    `<div class="grid g2" style="gap:10px">`+
      `<div>`+
        `<div class="lbl">PROJE ETİKETİ (opsiyonel)</div>`+
        `<input id="scanLabel" class="dg-png-input" placeholder="örn. deneme" oninput="dgScanPreviewName()" value="${esc(target?dgLabelFromLegacy(target.name,(park&&park.name)||""):"")}">`+
        `<div class="lbl" style="margin-top:8px">PROJE ADI</div>`+
        `<div id="scanNamePreview" class="mono" style="font-size:.85rem;padding:6px 0">${esc(dgProjectName((park&&park.name)||"",target?dgLabelFromLegacy(target.name,park&&park.name):""))}</div>`+
      `</div>`+
      `<div style="display:flex;flex-direction:column;gap:8px;justify-content:center">`+
        (target
          ? `<button class="btn" onclick="dgScanLinkTarget()">🔗 Bu parka bağla: ${esc(target.name)}</button>`
          : ``)+
        `<button class="btn blue" onclick="dgScanCreateProject()">📁 Yeni proje oluştur</button>`+
        (others.length
          ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">`+
              `<select id="scanBindProject" class="dg-png-select" style="flex:1;min-width:150px">`+
                others.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")+
              `</select>`+
              `<button class="btn sm ghost" onclick="dgScanBindExisting()">🔗 Bağla</button>`+
            `</div>`
          : ``)+
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
    toast("✓ Park kimliği yazıldı: "+esc(row.name),"ok","🌳");
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

async function dgScanCreateProject(){
  if(!USER)return toast("Oturum yok","err");
  const park=DG_PARK;
  if(!park)return toast("Park kimliği sunucuya yazılmadan proje oluşturulamaz. 🔄 ile yeniden dene.","err","🌳");
  const labelEl=$("scanLabel");
  const label=labelEl?String(labelEl.value||"").trim():"";

  const{data,error}=await sb.from("projects").insert({
    owner:USER.id,
    park_id:park.id,
    label,
    /* DB trigger'ı adı zaten kurar; istemci aynı kuralı gönderir ki
     * trigger çalışmazsa (eski şema) bile ad tutarlı kalsın. */
    name:dgProjectName(park.name,label),
    city:park.city||"",
    country:park.country||""
  }).select().single();

  if(error)return toast("Proje oluşturulamadı: "+esc(error.message),"err");

  toast("✓ Proje hazır: "+esc(data.name),"ok","📁");
  await dgAfterProjectLinked(data);
  return data;
}

async function dgScanLinkTarget(){
  if(!DG_PARK_TARGET_PROJ)return;
  await dgLinkProject(DG_PARK_TARGET_PROJ);
}

async function dgScanBindExisting(){
  const sel=$("scanBindProject");
  const pid=sel?+sel.value:0;
  if(!pid)return toast("Proje seç","err");
  await dgLinkProject(pid);
}

async function dgLinkProject(pid){
  const park=DG_PARK;
  if(!park)return toast("Önce park algıla","err","🌳");
  const proj=(PROJ_LIST||[]).find(p=>p.id===pid);
  if(!proj)return toast("Proje bulunamadı","err");

  /* Kart açıksa kullanıcının yazdığı etiket; değilse eski adın park sonrası
   * kısmı etiket olur. */
  const labelEl=$("scanLabel");
  let label=labelEl
    ? String(labelEl.value||"").trim()
    : dgLabelFromLegacy(proj.name,park.name);

  /* ⚠ VERİ KAYBI KORUMASI: projeyi İLK KEZ bir parka bağlıyorsak ve etiket boş
   * kaldıysa, eski ad etikete taşınır. Yoksa "Eski Proje" → "Göksu Parkı" olur
   * ve kullanıcının verdiği ad sessizce kaybolurdu. Zaten bu parka bağlı bir
   * projede etiket boş bırakılırsa bu BİLİNÇLİ bir yeniden adlandırmadır
   * (ad = park adı) ve dokunulmaz. */
  if(!label&&proj.park_id!==park.id){
    const legacy=dgLabelFromLegacy(proj.name,park.name);
    if(legacy&&legacy!==park.name)label=legacy;
  }

  const{data,error}=await sb.from("projects").update({
    park_id:park.id,
    label
  }).eq("id",pid).select().single();

  if(error)return toast("Bağlanamadı: "+esc(error.message),"err");

  /* Ölçümlerin denormalize park_id'sini de doldur (view zaten yedekli okur,
   * ama sorgu hızı ve dışa aktarım alanı için tutarlılık iyi). */
  try{
    await sb.from("measurements").update({park_id:park.id}).eq("project_id",pid).is("park_id",null);
  }catch(e){}

  toast("✓ "+esc(data.name)+" → "+esc(park.name),"ok","🔗");
  await dgAfterProjectLinked(data);
  return data;
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
    box.innerHTML=
      `<b>⛔ Bu projede park algılanmadı — ölçüm girilemez.</b><br>`+
      `<span style="font-size:.82rem">Proje: <b>${esc(p.name)}</b>. `+
      `Park algılamadan girilen ölçümler karşılaştırmada parka bağlanamıyor; `+
      `bu yüzden önce park kimliği oluşturuluyor.</span>`+
      `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">`+
        `<button class="btn sm blue" onclick="startParkScan({projectId:${p.id},returnTo:'measure'})">🌳 Parkı Algıla ve Bağla</button>`+
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
    `<b>🌳 ${esc(parkName)}</b> · proje: <b>${esc(p.name)}</b>`+
    (p.parks&&p.parks.area_m2?` · ${dgFmtHa(p.parks.area_m2)}`:``)+
    `<br><span style="font-size:.78rem">Bu parktaki tüm kullanıcıların verileri karşılaştırmada tek satırda toplanır.</span>`+
    ` <button class="btn sm ghost" style="margin-left:8px" onclick="startParkScan({projectId:${p.id},returnTo:'measure'})">Parkı değiştir</button>`;
  if(save)save.disabled=false;
  return true;
}

/* Proje seçimi değişti (v-measure). shell.html'deki onchange bunu çağırır. */
function dgProjectChanged(){
  dgParkGate();
  if(typeof manualPoint!=="undefined"&&!manualPoint&&typeof autoFillPointId==="function"){
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

/* Park bağı olmayan projeleri, ölçümlerinin merkezinden OSM park sorgusuyla
 * eşleştirir. İKİ FAZLI: önce plan çıkarır ve önizleme gösterir (hiçbir şey
 * yazmaz), yönetici onaylayınca dgApplyBackfill() yazar. Sebep: bu araç eski
 * proje ADLARINI da değiştirir ("Göksu Parkı - <eski ad>"); sürpriz olmasın. */
async function backfillParks(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
  const box=$("backfillBox");

  const{data:projs,error}=await sb.from("projects").select("id,name,owner,park_id,park_name,label,city,country");
  if(error)return toast("Projeler okunamadı: "+esc(error.message),"err");
  const targets=(projs||[]).filter(p=>!p.park_id);

  if(!targets.length){
    if(box){box.style.display="block";box.innerHTML=`<div class="alert ok">✓ Park bağı eksik proje yok.</div>`;}
    return toast("Park bağı eksik proje yok ✓","ok","🌳");
  }

  if(box){
    box.style.display="block";
    box.innerHTML=`<div class="alert info">⏳ ${targets.length} proje taranıyor — her biri için ölçüm merkezi hesaplanıp OSM'de park aranıyor (Overpass nezaketi: ~2 sn arayla)…</div>`;
  }

  const plan=[];
  for(const p of targets){
    const{data:m}=await sb.from("measurements").select("lat,lon").eq("project_id",p.id).limit(1000);
    const pts=(m||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
    if(!pts.length){
      plan.push({project:p,durum:"ölçüm yok",park:null});
      continue;
    }
    const lat=pts.reduce((a,r)=>a+ +r.lat,0)/pts.length;
    const lon=pts.reduce((a,r)=>a+ +r.lon,0)/pts.length;

    let cands=null;
    try{cands=await queryPark(lat,lon,1500);}catch(e){}
    await new Promise(r=>setTimeout(r,2100));

    if(!cands||!cands.length){
      plan.push({project:p,durum:"OSM'de park yok",park:null,lat,lon});
      continue;
    }
    const c=cands[0];
    plan.push({
      project:p,
      durum:"eşleşti",
      cand:c,
      lat,lon,
      parkName:c.name||"İsimsiz Park",
      newName:dgProjectName(c.name||"İsimsiz Park",dgLabelFromLegacy(p.name,c.name||""))
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
    `<div class="alert info" style="margin:6px 0">Plan: <b>${ok.length}</b> proje parka bağlanacak · `+
    `<b>${noPark.length}</b> projede OSM parkı yok (elle oluşturulmalı) · <b>${noMeas.length}</b> projede ölçüm yok.</div>`+
    `<div class="tblwrap" style="max-height:320px;overflow:auto"><table>`+
      `<thead><tr><th>Proje (eski ad)</th><th>Park</th><th>Yeni ad</th><th>Alan</th><th>Durum</th></tr></thead><tbody>`+
      plan.map(x=>`<tr>`+
        `<td>${esc(x.project.name)}</td>`+
        `<td>${esc(x.parkName||"—")}</td>`+
        `<td>${esc(x.newName||"—")}</td>`+
        `<td>${x.cand?dgFmtHa(x.cand.area):"—"}</td>`+
        `<td>${x.durum==="eşleşti"?'<span class="badge on">✓</span>':'<span class="badge admin">'+esc(x.durum)+'</span>'}</td>`+
      `</tr>`).join("")+
    `</tbody></table></div>`+
    (ok.length
      ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">`+
          `<button class="btn amber" onclick="dgApplyBackfill()">✓ Planı Uygula (${ok.length} proje)</button>`+
          `<button class="btn sm ghost" onclick="dgCloseBackfill()">Kapat</button>`+
        `</div>`
      : `<div class="alert err" style="margin-top:8px">Bağlanacak proje çıkmadı. OSM'de olmayan parklar için Canlı Harita → Park Algılama → "elle oluştur" kullanın.</div>`);
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
  if(!confirm(plan.length+" proje parka bağlanacak ve adları yeniden kurulacak. Devam?"))return;

  let ok=0,fail=0;
  for(const x of plan){
    /* Park kimliğini yaz/oku (kayıt burada oluşur; aynı park birden çok
     * projede geçiyorsa dgRegisterPark aynı satırı döndürür). */
    const park=await dgRegisterPark(x.cand,{lat:x.lat,lon:x.lon,source:"backfill"});
    if(!park){fail++;continue;}

    const{error}=await sb.from("projects").update({
      park_id:park.id,
      label:dgLabelFromLegacy(x.project.name,park.name)
    }).eq("id",x.project.id);

    if(error){fail++;console.warn("DENDROGEO · backfill proje hatası:",error.message);continue;}

    try{
      await sb.from("measurements").update({park_id:park.id}).eq("project_id",x.project.id).is("park_id",null);
    }catch(e){}
    ok++;
  }

  toast(`✓ ${ok} proje parka bağlandı${fail?` · ${fail} hata`:""}`,fail?"warn":"ok","🌳");
  DG_BACKFILL_PLAN=null;
  dgCloseBackfill();
  if(typeof loadProjects==="function")loadProjects();
  if(typeof loadWorld==="function")loadWorld();
  if(typeof loadAdmin==="function")loadAdmin();
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

function dgParkSchemaMissing(reason){
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
window.dgCreateManualPark=dgCreateManualPark;
window.dgShowManualParkForm=dgShowManualParkForm;
window.dgToggleParkModeFromScan=dgToggleParkModeFromScan;
window.dgCancelScan=dgCancelScan;
window.dgShowProjectStep=dgShowProjectStep;
window.dgParkIdChip=dgParkIdChip;
window.dgRetryRegister=dgRetryRegister;
window.dgScanCreateProject=dgScanCreateProject;
window.dgScanLinkTarget=dgScanLinkTarget;
window.dgScanBindExisting=dgScanBindExisting;
window.dgScanPreviewName=dgScanPreviewName;
window.dgParkGate=dgParkGate;
window.dgProjectChanged=dgProjectChanged;
window.backfillParks=backfillParks;
window.dgApplyBackfill=dgApplyBackfill;
window.dgCloseBackfill=dgCloseBackfill;
