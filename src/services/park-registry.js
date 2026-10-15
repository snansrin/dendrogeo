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
 if(window.DG_PRESENT_PARK_SEARCH_RESULT)return window.DG_PRESENT_PARK_SEARCH_RESULT.present(result,{toast,escape:esc,translate:_tpr,translateCommon:dgCf,selectPark:park=>{DG_PARK_CAND=null;DG_PARK=park;},renderCard:dgRenderScanCard,detectAt:dgDetectAt});
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
 if(window.DG_DETECT_PARK_AT_CURRENT_LOCATION)return window.DG_DETECT_PARK_AT_CURRENT_LOCATION.detect({gps:GPS,notifyMissing:()=>toast("Önce 📡 Konumu Etkinleştir","warn","🛰"),startGps:()=>{if(typeof startGps==="function")startGps();},detectAt:dgDetectAt});
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
 if(window.DG_PRESENT_MANUAL_PARK_RESULT)return window.DG_PRESENT_MANUAL_PARK_RESULT.offer(lat,lon,{offerAt:point=>{DG_PARK_CAND=null;DG_PARK=null;DG_PARK_ANCHOR=point;DG_MANUAL_PENDING={...point};},renderCard:dgRenderScanCard,toast});
  DG_PARK_CAND=null;
  DG_PARK=null;
  DG_PARK_ANCHOR={lat,lon};
  DG_MANUAL_PENDING={lat,lon};
  dgRenderScanCard(true);
  toast("Bu noktada OSM parkı bulunamadı — elle park oluşturabilirsin.","warn","🌳");
}

async function dgCreateManualPark(){
  const result=await DG_PARK_MANUAL_CREATION_USE_CASE();
  if(window.DG_PRESENT_MANUAL_PARK_RESULT)return window.DG_PRESENT_MANUAL_PARK_RESULT.created(result,{toast,escape:esc,translateCommon:dgCf,selectPark:park=>{DG_PARK=park;DG_MANUAL_PENDING=null;},renderCard:dgRenderScanCard});
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
  return window.DG_START_PARK_SCAN.start(opt,{
    setActive:value=>{DG_PARK_SCAN=value;},setTargetProject:value=>{DG_PARK_TARGET_PROJ=value;},setReturnTo:value=>{DG_PARK_RETURN_TO=value;},
    go:view=>{if(typeof go==="function")go(view);},parkMode:()=>typeof PARK_MODE!=="undefined"&&PARK_MODE,
    toggleParkMode:()=>{if(typeof toggleParkMode==="function")toggleParkMode();},schedule:(fn,delay)=>setTimeout(fn,delay),
    map:()=>typeof map!=="undefined"?map:null,focusTarget:()=>dgFocusScanTarget(),render:()=>dgRenderScanCard(),
    card:()=>$("parkScanCard"),notify:(...args)=>toast(...args)
  });
}

/* Hedefe odaklan: bağlanacak projenin ölçümleri → GPS → mevcut görünüm */
async function dgFocusScanTarget(){
  return window.DG_FOCUS_PARK_SCAN_TARGET.focus(DG_PARK_TARGET_PROJ,{
    map:()=>typeof map!=="undefined"?map:null,
    readProjectMeasurements:projectId=>window.DG_PARK_PROJECT_READ_STORE.fetchMeasurements({client:sb,projectId,limit:500}),
    bounds:points=>L.latLngBounds(points),gps:()=>typeof GPS!=="undefined"?GPS:null
  });
}

/* =========================================================
   5. ALGILAMA KARTI (v-map üstündeki adım adım akış)
========================================================= */

/* 0040: kaydırma koruma sarmalı. */
function dgRenderScanCard(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgRenderScanCard__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgRenderScanCard__scroll(forceManual){
  const el=window.DG_PARK_SCAN_CARD_UI.prepare({document});
  if(!el)return;
  return window.DG_PARK_SCAN_CARD_UI.render({
    element:el,park:DG_PARK,candidate:DG_PARK_CAND,
    showManual:forceManual===true||!!DG_MANUAL_PENDING,scanActive:DG_PARK_SCAN,
    schemaWarning:dgSchemaWarnHTML(),step:dgScanStep(),isAdmin:dgIsAdmin(),
    targetProjectId:DG_PARK_TARGET_PROJ,projects:PROJ_LIST,returnTo:DG_PARK_RETURN_TO,
    escape:esc,formatArea:dgFmtHa,manualForm:dgManualFormHTML,
    labelFromLegacy:dgLabelFromLegacy,projectName:dgProjectName,
    actions:{toggleParkMode:dgToggleParkModeFromScan,detectAtLocation:dgDetectAtMyLocation,findByName:dgScanSearchByName,
      showManualForm:dgShowManualParkForm,retryRegister:dgRetryRegister,previewName:dgScanPreviewName,
      createProject:dgScanCreateProject,cancelScan:dgCancelScan}
  });
}

function dgScanStep(){
  return window.DG_SELECT_PARK_SCAN_STEP.select(DG_PARK,DG_PARK_CAND);
}

function dgScanPreviewName(){
  return window.DG_PREVIEW_PARK_PROJECT_NAME.update($("scanNamePreview"),$("scanLabel"),DG_PARK,DG_PARK_CAND,dgProjectName);
}

function dgManualFormHTML(open){
  const point=window.DG_RESOLVE_MANUAL_PARK_COORDINATE.resolve({pending:DG_MANUAL_PENDING,anchor:DG_PARK_ANCHOR,gps:GPS});
  return window.DG_PARK_IDENTITY_UI.manualForm({open,point,document,actions:{create:()=>dgCreateManualPark()}});
}

function dgShowManualParkForm(){
  return window.DG_SHOW_MANUAL_PARK_FORM.show({element:$,setPending:value=>{DG_MANUAL_PENDING=value;},resolvePoint:()=>window.DG_RESOLVE_MANUAL_PARK_COORDINATE.resolve({pending:DG_MANUAL_PENDING,anchor:DG_PARK_ANCHOR,gps:GPS}),renderCard:dgRenderScanCard});
}

function dgToggleParkModeFromScan(){
  return window.DG_TOGGLE_PARK_MODE_FROM_SCAN.toggle({toggle:()=>toggleParkMode(),renderCard:dgRenderScanCard});
}

function dgCancelScan(){
  return window.DG_CANCEL_PARK_SCAN.cancel({
    setActive:value=>{DG_PARK_SCAN=value;},setTargetProject:value=>{DG_PARK_TARGET_PROJ=value;},returnTo:()=>DG_PARK_RETURN_TO,
    setReturnTo:value=>{DG_PARK_RETURN_TO=value;},render:()=>dgRenderScanCard(),go:view=>{if(typeof go==="function")go(view);}
  });
}

/* DB kaydı başarısız olduysa (çevrimdışı/RLS) yeniden dene. */
async function dgRetryRegister(){
  return window.DG_RETRY_PARK_REGISTRATION.retry(DG_PARK_CAND,{register:candidate=>dgRegisterPark(candidate,{}),setPark:row=>{DG_PARK=row;},renderCard:dgRenderScanCard,notify:(message,...args)=>toast(dgCf(message),...args),successMessage:row=>"✓ Park kimliği yazıldı: "+esc(row.name),recordPresence:(action,name)=>{if(typeof dgPresenceAct==="function"){try{dgPresenceAct(action,name);}catch(e){}}}});
}

/* Panel başlığındaki kimlik çipi: park DB'de mi, hangi anahtarla? */
function dgParkIdChip(parkRow){
  return window.DG_PARK_IDENTITY_UI.chip({parkRow,escape:esc});
}

/* Paneldeki "Proje oluştur / bağla" düğmesi: algılama kartının 3. adımına götürür. */
function dgShowProjectStep(){
  return window.DG_SHOW_PARK_PROJECT_STEP.show({setScanActive:value=>{DG_PARK_SCAN=value;},renderCard:dgRenderScanCard,element:$});
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
const DG_PARK_BACKFILL_PROJECT_LINK=window.DG_LINK_BACKFILL_PROJECT_TO_PARK&&window.DG_BUILD_BACKFILL_PROJECT_LINK?window.DG_LINK_BACKFILL_PROJECT_TO_PARK.create({
  buildPatch:(project,park)=>window.DG_BUILD_BACKFILL_PROJECT_LINK.build(project,park),
  updateProject:(id,patch)=>DG_PARK_PROJECT_LINK_STORE.updateBackfillProject(id,patch),
  backfillMeasurements:(projectId,parkId)=>DG_PARK_PROJECT_LINK_STORE.backfillMeasurements(projectId,parkId)
}):null;
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
  if(window.DG_PRESENT_PARK_PROJECT_RESULT)return window.DG_PRESENT_PARK_PROJECT_RESULT.present("create",result,{toast,escape:esc,translateCommon:dgCf,complete:dgAfterProjectLinked});
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
  if(window.DG_PRESENT_PARK_PROJECT_RESULT)return window.DG_PRESENT_PARK_PROJECT_RESULT.present("link",result,{toast,escape:esc,translateCommon:dgCf,complete:dgAfterProjectLinked});
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
  if(typeof window!=="undefined"&&Object.prototype.hasOwnProperty.call(window,"DG_COMPLETE_PARK_PROJECT_LINK"))return window.DG_COMPLETE_PARK_PROJECT_LINK.complete(proj,{loadProjects:typeof loadProjects==="function"?()=>loadProjects():null,element:$,refreshGate:()=>{if(typeof dgParkGate==="function")dgParkGate();},getReturnTo:()=>DG_PARK_RETURN_TO,setScanActive:value=>{DG_PARK_SCAN=value;},setTargetProject:value=>{DG_PARK_TARGET_PROJ=value;},setReturnTo:value=>{DG_PARK_RETURN_TO=value;},renderCard:dgRenderScanCard,go:view=>{if(typeof go==="function")go(view);}});
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
  if(typeof window!=="undefined"&&Object.prototype.hasOwnProperty.call(window,"DG_SELECT_PARK_PROJECT"))return window.DG_SELECT_PARK_PROJECT.resolve(sel?sel.value:"",PROJ_LIST);
  const pid=sel?+sel.value:0;
  if(!pid)return null;
  return (PROJ_LIST||[]).find(p=>p.id===pid)||null;
}

/* Ölçüm sekmesine OTOMATİK yönlendirme proje başına bir kez yapılır.
 * Sebep: kullanıcı "Yeni Ölçüm"e her tıkladığında haritaya fırlatılırsa
 * ölçüm sekmesine hiç ulaşamaz (kapan); ikinci denemede banner'ı okuyup
 * ne yapacağına kendisi karar verir. */
function dgScanRedirectedOnce(pid){
  if(typeof window!=="undefined"&&Object.prototype.hasOwnProperty.call(window,"DG_PARK_SCAN_REDIRECT_MEMORY"))return window.DG_PARK_SCAN_REDIRECT_MEMORY.wasRedirectedOrMark(pid,()=>sessionStorage);
  const key="dg_park_scan_"+pid;
  try{
    if(sessionStorage.getItem(key))return true;
    sessionStorage.setItem(key,"1");
    return false;
  }catch(e){return true;}   /* gizli mod: yönlendirme döngüsüne girme */
}

const DG_PARK_MEASUREMENT_GATE=window.DG_PARK_MEASUREMENT_GATE_APPLICATION.create({
  schemaReady:()=>DG_PARK_SCHEMA_OK,
  editing:()=>typeof EDIT_ID!=="undefined"&&!!EDIT_ID,
  hasGate:()=>!!$("parkGate"),
  getProject:dgSelectedProject,
  isAdmin:dgIsAdmin,
  redirectAlreadyUsed:dgScanRedirectedOnce
});

/* Ölçüm ekranının üstündeki kapı kartı. saveMeas() da aynı kontrolü yapar —
 * kart yalnız görsel geri bildirim değil, butonu gerçekten kilitler.
 * Sunucu tarafı garanti: trg_enforce_park_link (PARK_REQUIRED).
 * auto=true (sekme açılışı) → parksız projede kullanıcı doğrudan park
 * algılama ekranına götürülür ("ölçüm yapılacağı zaman direkt park algılama
 * ekranına yönlendirsin"). */
function dgParkGate(auto){
  const box=$("parkGate");
  const save=$("saveBtn");
  const result=DG_PARK_MEASUREMENT_GATE(auto);
  const view=DG_PARK_MEASUREMENT_GATE_UI.render({
    result,box,save,escape:esc,formatArea:dgFmtHa,schemaWarningHTML:dgSchemaWarnHTML,
    actions:{scan:options=>startParkScan(options),admin:()=>go('admin')}
  });
  if(view.redirect)startParkScan(view.redirect);
  return view.allowed;
}

/* Proje seçimi değişti (v-measure). shell.html'deki onchange bunu çağırır. */
function dgProjectChanged(){
 if(typeof window!=="undefined"&&Object.prototype.hasOwnProperty.call(window,"DG_HANDLE_PARK_PROJECT_CHANGE"))return window.DG_HANDLE_PARK_PROJECT_CHANGE.changed({selectedValue:()=>window.DG_PARK_PROJECT_OPTIONS_UI.readSelected(document),rememberProject:value=>{if(typeof dgProjectRemember==="function")dgProjectRemember(value);},joinCurrentPark:()=>{if(typeof dgLiveShareJoinCurrent==="function")dgLiveShareJoinCurrent();},refreshGate:()=>dgParkGate(),hasManualPoint:()=>typeof manualPoint!=="undefined"&&!!manualPoint,isEditing:()=>!!EDIT_ID,refreshPointSuggestion:()=>{window.DG_PARK_PROJECT_OPTIONS_UI.clearPointSuggestion(document);if(typeof autoFillPointId==="function")autoFillPointId();}});
 /* 0045: seçim cihaz belleğine yazılır (yenilemede geri gelir). */
 if(typeof dgProjectRemember==="function"){try{dgProjectRemember(window.DG_PARK_PROJECT_OPTIONS_UI.readSelected(document));}catch(e){}}
 /* 0036 (T5): proje değişince canlı konum kanalı yeni parka taşınır. */
 if(typeof dgLiveShareJoinCurrent==="function"){try{dgLiveShareJoinCurrent();}catch(e){}}
  dgParkGate();
  if(typeof manualPoint!=="undefined"&&!manualPoint&&!EDIT_ID&&typeof autoFillPointId==="function"){
    window.DG_PARK_PROJECT_OPTIONS_UI.clearPointSuggestion(document);
    autoFillPointId();
  }
}

/* Proje listesi seçeneği: parkı olan 🌳, olmayan ⛔ ile işaretlenir. */
function dgProjectOptionLabel(p){
  return window.DG_PARK_PROJECT_OPTIONS_UI.label(p);
}

/* Grid panelindeki proje seçimi yalnız bu parkın projelerini gösterir:
 * grid/waypoint yanlışlıkla başka parka yazılmasın. */
function dgProjectOptionsForPark(parkId,fallbackAll){
  return window.DG_PARK_PROJECT_OPTIONS_UI.forPark({
    parkId,fallbackAll,projects:PROJ_LIST,escape:esc
  });
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
const DG_PARK_BACKFILL_CONTROLLER=window.DG_PARK_BACKFILL_CONTROLLER.create({
  window,document:typeof document==="undefined"?null:document,setTimeout:(...args)=>setTimeout(...args),element:id=>$(id),escape:value=>esc(value),toast:(...args)=>toast(...args),
  translateFormat:(...args)=>_tprf(...args),translateCommon:value=>dgCf(value),
  isAdmin:()=>!!PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"),isOnline:()=>navigator.onLine,getClient:()=>sb,
  queryPark:(...args)=>queryPark(...args),warn:(...args)=>console.warn(...args),
  normalizeLoose:name=>dgNormParkLoose(name),overpassRequest:(...args)=>overpassRequest(...args),extractRings:element=>extractRings(element),polyArea:rings=>polyArea(rings),
  formatArea:area=>dgFmtHa(area),suggestParkName:name=>dgSuggestParkName(name),projectName:(name,label)=>dgProjectName(name,label),labelFromLegacy:(name,parkName)=>dgLabelFromLegacy(name,parkName),registerPark:(candidate,options)=>dgRegisterPark(candidate,options),
  linkBackfillProject:DG_PARK_BACKFILL_PROJECT_LINK?(project,park)=>DG_PARK_BACKFILL_PROJECT_LINK(project,park):null,
  updateBackfillProject:(id,patch)=>DG_PARK_PROJECT_LINK_STORE.updateBackfillProject(id,patch),backfillMeasurements:(projectId,parkId)=>DG_PARK_PROJECT_LINK_STORE.backfillMeasurements(projectId,parkId),
  confirm:(...args)=>confirm(...args),refreshAfterWrites:()=>dgAfterBackfillWrites()
});
async function dgQueryParkSafe(lat,lon,radius){return DG_PARK_BACKFILL_CONTROLLER.queryParkSafe(lat,lon,radius);}
async function dgQueryParkByName(lat,lon,name){return DG_PARK_BACKFILL_CONTROLLER.queryParkByName(lat,lon,name);}
async function dgDetectParkForProject(lat,lon,name){return DG_PARK_BACKFILL_CONTROLLER.detectParkForProject(lat,lon,name);}
async function backfillParks(){return DG_PARK_BACKFILL_CONTROLLER.backfillParks();}
function dgRenderBackfillPlan(){return DG_PARK_BACKFILL_CONTROLLER.renderPlan();}
function dgCloseBackfill(){return DG_PARK_BACKFILL_CONTROLLER.closePlan();}
async function dgApplyBackfill(){return DG_PARK_BACKFILL_CONTROLLER.applyBackfill();}
async function dgLinkProjectToPark(project,park){return DG_PARK_BACKFILL_CONTROLLER.linkProjectToPark(project,park);}
async function dgBackfillManual(projectId){return DG_PARK_BACKFILL_CONTROLLER.backfillManual(projectId);}
function dgAfterBackfillWrites(){
  if(!window.DG_REFRESH_AFTER_PARK_BACKFILL){if(typeof loadProjects==="function")loadProjects();if(typeof loadWorld==="function")loadWorld();if(typeof loadAdmin==="function")loadAdmin();return;}
  return window.DG_REFRESH_AFTER_PARK_BACKFILL.refresh({loadProjects:typeof loadProjects==="function"?loadProjects:null,loadWorld:typeof loadWorld==="function"?loadWorld:null,loadAdmin:typeof loadAdmin==="function"?loadAdmin:null});
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
const DG_PARK_ADMIN_CONTROLLER=window.DG_PARK_ADMIN_CONTROLLER.create({
  window,getClient:()=>sb,isAdmin:dgIsAdmin,element:id=>$(id),escape:value=>esc(value),toast:(...args)=>toast(...args),
  keepScroll:typeof dgScrollKeep==="function"?dgScrollKeep:null,
  restoreScroll:typeof dgScrollRestore==="function"?dgScrollRestore:null,
  loadApplication:()=>window.DG_PARK_ADMIN_LOAD_APPLICATION.create({
    isAdmin:()=>!!PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"),
    showLoading:()=>window.DG_PARK_ADMIN_STATUS_UI.parkLoading($("parkAdminBox")),
    fetchParks:()=>window.DG_PARK_ADMIN_READ_STORE.fetchParks(sb),
    fetchProjects:()=>window.DG_PARK_ADMIN_READ_STORE.fetchProjects(sb),
    fetchMeasurements:()=>window.DG_PARK_ADMIN_READ_STORE.fetchMeasurements(sb)
  })(),
  loadProjects:typeof loadProjects==="function"?loadProjects:null,
  loadWorld:typeof loadWorld==="function"?loadWorld:null,
  loadAdminTree:typeof loadAdminTree==="function"?loadAdminTree:null,
  normalizeLoose:value=>dgNormParkLoose(value),normalizeName:value=>dgNormParkName(value),formatHectares:value=>dgFmtHa(value),distance:(...args)=>hav(...args),
  translate:value=>_tpr(value),translateFormat:(...args)=>_tprf(...args),translateCommon:value=>dgCf(value),translatePlain:value=>typeof dgT==="function"?dgT(value):value,
  prompt:(...args)=>prompt(...args),confirm:(...args)=>confirm(...args),clearParkSession:()=>DG_PARK_SESSION.clear(),backfillGeometry:id=>dgBackfillGeom(id)
});
const DG_PARK_ADMIN_STATE=DG_PARK_ADMIN_CONTROLLER.state;
const DG_PARK_ADMIN_MUTATION_STORE=DG_PARK_ADMIN_CONTROLLER.mutationStore;
const DG_PARK_PROJECT_NAME_SYNC=DG_PARK_ADMIN_CONTROLLER.syncProjectNames;
async function loadParkAdmin(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkAdmin__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkAdmin__scroll(){return DG_PARK_ADMIN_CONTROLLER.loadParkAdmin();}
function dgRenderParkAdmin(projects,measurements){return DG_PARK_ADMIN_CONTROLLER.renderParkAdmin(projects,measurements);}
async function dgResyncProjectNames(parkId,knownName){return DG_PARK_PROJECT_NAME_SYNC(parkId,knownName);}
function dgParkRename(id){return DG_PARK_ADMIN_CONTROLLER.parkRename(id);}
function dgParkMergeFromSelect(id){return DG_PARK_ADMIN_CONTROLLER.parkMergeFromSelect(id);}
function dgParkMergeInto(sourceId,destinationId){return DG_PARK_ADMIN_CONTROLLER.parkMergeInto(sourceId,destinationId);}
function dgParkDelete(id){return DG_PARK_ADMIN_CONTROLLER.parkDelete(id);}
function dgAfterParkAdminChange(){return DG_PARK_ADMIN_CONTROLLER.afterChange();}

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
  if(typeof window!=="undefined"&&Object.prototype.hasOwnProperty.call(window,"DG_HANDLE_PARK_DRAWN"))return window.DG_HANDLE_PARK_DRAWN.handle(cand,{isOnline:()=>navigator.onLine,register:candidate=>dgRegisterPark(candidate,{}),notifyOffline:()=>toast("Çevrimdışı: park kimliği yazılamıyor. Ölçüm için bağlantı gerek.","warn","📴"),setCandidate:value=>{DG_PARK_CAND=value;},setPark:value=>{DG_PARK=value;},renderCard:dgRenderScanCard});
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

const DG_PARK_SCHEMA_MISSING_FEEDBACK=window.DG_PARK_SCHEMA_MISSING_FEEDBACK
 ?window.DG_PARK_SCHEMA_MISSING_FEEDBACK.create({warn:(...args)=>console.warn(...args),toast:(...args)=>toast(...args),isAdmin:()=>typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner")})
 :null;
const DG_PARK_SCHEMA_MISSING_HANDLER=window.DG_HANDLE_PARK_SCHEMA_MISSING_APPLICATION&&DG_PARK_SCHEMA_MISSING_FEEDBACK
 ?window.DG_HANDLE_PARK_SCHEMA_MISSING_APPLICATION.create({
  isSchemaError:dgIsSchemaError,
  hasWarned:()=>DG_PARK_SCHEMA_WARNED,
  markWarned:()=>{DG_PARK_SCHEMA_WARNED=true;},
  disableSchema:()=>{DG_PARK_SCHEMA_OK=false;},
  notifyTransient:reason=>DG_PARK_SCHEMA_MISSING_FEEDBACK.notifyTransient(reason),
  notifyMissing:reason=>DG_PARK_SCHEMA_MISSING_FEEDBACK.notifyMissing(reason),
  renderCard:dgRenderScanCard
 })
 :null;

function dgParkSchemaMissing(reason){
 if(DG_PARK_SCHEMA_MISSING_HANDLER)return DG_PARK_SCHEMA_MISSING_HANDLER.handle(reason);
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
 return window.DG_PARK_SCHEMA_WARNING_UI.render({available:DG_PARK_SCHEMA_OK});
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
  return DG_OSM_PARK_RING_ADAPTER.create({fetch,joinWaysToRings})(osmKey);
}
const DG_PARK_GEOMETRY_BACKFILL_STORE=window.DG_PARK_GEOMETRY_BACKFILL_STORE.create({getClient:()=>sb});
const DG_PARK_GEOMETRY_BACKFILL_FEEDBACK=window.DG_PARK_GEOMETRY_BACKFILL_FEEDBACK
  ?window.DG_PARK_GEOMETRY_BACKFILL_FEEDBACK.create({toast:(...args)=>toast(...args),escape:value=>esc(value),format:value=>dgCf(value)})
  :{notify:(kind,park,error)=>{
    if(kind==="loading")toast("🛰 OSM sınırı çekiliyor…","info","🛰");
    if(kind==="osm-error")toast(dgCf("OSM hatası: ")+esc(error.message),"err","🛰");
    if(kind==="boundary-not-found")toast("OSM'de kapalı sınır bulunamadı (relation parçalı olabilir).","warn","🛰");
    if(kind==="write-error")toast(dgCf("Yazılamadı (yetki/ağ): ")+esc(error.message),"err","🛰");
    if(kind==="saved")toast("✓ "+esc(park.name)+" geometrisi yazıldı — çit artık tam poligonla.","ok","🛰");
  }};
const DG_PARK_GEOMETRY_BACKFILL_USE_CASE=window.DG_PARK_GEOMETRY_BACKFILL_APPLICATION.create({
  isAdmin:()=>!!(PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner")),
  getPark:parkId=>DG_PARK_GEOMETRY_BACKFILL_STORE.getPark(parkId),
  fetchRing:dgFetchOsmRing,
  calculateArea:geom=>typeof polyArea==="function"?polyArea(geom.outer):NaN,
  resolveArea:window.DG_RESOLVE_PARK_GEOMETRY_BACKFILL_AREA?(area,park)=>window.DG_RESOLVE_PARK_GEOMETRY_BACKFILL_AREA.resolve(area,park.area_m2):undefined,
  saveGeometry:(parkId,update)=>DG_PARK_GEOMETRY_BACKFILL_STORE.saveGeometry(parkId,update),
  notify:(kind,park,error)=>DG_PARK_GEOMETRY_BACKFILL_FEEDBACK.notify(kind,park,error),
  onComplete:()=>loadParkAdmin()
});
async function dgBackfillGeom(parkId){
  const result=await DG_PARK_GEOMETRY_BACKFILL_USE_CASE(parkId);
  if(result.status==="forbidden")return toast("Yetki yok.","err");
  if(result.status==="park-not-found")return toast("Park bulunamadı","err");
}
window.dgBackfillGeom=dgBackfillGeom;
function dgParkAdminToggleEmpty(){
 return DG_PARK_ADMIN_CONTROLLER.toggleEmpty();
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
