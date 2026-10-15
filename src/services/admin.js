"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tad=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tadf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* DendroGeo · services/admin.js — ÖLÇÜM ONAY & MODERASYON ÇEKİRDEĞİ (Faz 6)
 * Ziyaret sayacı → visit-stats.js, veri talepleri → data-requests.js,
 * kullanıcı yönetimi → user-admin.js, yedek → backup.js'e taşındı.
 * Burada kalanlar: onay/red/silme, depolama istatistikleri, yetim temizliği,
 * yeniden coğdalama, bağımlı filtre yardımcıları (listCountries/listCities/
 * listProjects/fillSelect — data-requests de bunları çağırır), yönetici toplu
 * dışa aktarımı ve REQ_ROWS/ADM_ROWS paylaşılan filtre state'i. */

/* 0043: Düz liste çizimi TEK yerde — hem loadAdmin (taze sunucu verisi) hem
 * iyimser onay/red (admin-tree.js DG_TREE_ROWS önbelleği) buradan çizer; kod
 * tekrarlamaz, iki görünüm (ağaç + düz liste) tutarlı kalır. data-mid: satırı
 * kayıt kimliğiyle bulmayı sağlar (hedefli güncelleme/hata ayıklama). */
function dgFlatRowHTML(x){
  /* Locked markup contracts retained in src/ui/admin-measurement-row.js:
   * (+x.dbh_cm).toFixed(1); dgThumb(x.photo_url); onclick="dgGeoOverride(. */
  return window.DG_ADMIN_MEASUREMENT_ROW_UI.render(x,{escape:esc,latin:LATIN,thumbnail:dgThumb});
}
function dgRenderFlatTable(rows){
  /* Locked contract retained: sort((a,b)=>((+a.project_id||0)-(+b.project_id||0))||((+a.point_id||0)-(+b.point_id||0))). */
  window.DG_ADMIN_MEASUREMENT_TABLE_UI.mount(document,rows,{renderRow:dgFlatRowHTML});
}

/* 0043 · SEKMELİ (debounced) ARKA PLAN MUTABAKAT
 * İyimser onay/red ağacı + düz listeyi + rozetleri ANINDA yerel önbellekten
 * günceller (ağ turu yok, sıçrama yok, TEK çizim). Sunucuyla tam mutabakat
 * için her onayda ağır loadAdmin çağırmak YERİNE, son tıktan ~1 sn sonra TEK
 * bir HAFİF tazeleme yapılır: ağaç SUNUCUDAN YENİDEN ÇEKİLMEZ (ikinci tam
 * çizim = gereksiz titreme + taze tıkla yarışma); yalnız onayla DEĞİŞEN üst
 * istatistik (aCarbon: onaylı karbon, v_global) ve dünya karşılaştırması
 * tazelenir. Dünya sekmesi gizli görünümde çizilir → admin sekmesi
 * kaydırmasını ETKİLEMEZ. Böylece "bir sürü veri" hızlıca onaylanırken ağaç
 * anlık ve TEK çizimde kalır, ağ yükü patlamaz, sıçrama/titreme olmaz. */
let DG_ADMIN_SYNC_T=null;
function dgAdminSyncSoon(){
  if(DG_ADMIN_SYNC_T)clearTimeout(DG_ADMIN_SYNC_T);
  DG_ADMIN_SYNC_T=setTimeout(async()=>{
    DG_ADMIN_SYNC_T=null;
    try{
      const global=await window.DG_ADMIN_OVERVIEW_STORE.create(()=>sb).loadGlobal();
      if(global?.data)window.DG_ADMIN_OVERVIEW_METRICS_UI.updateCarbon(global.data.carbon_t,$);
      await loadWorld();
    }catch(error){console.warn("DENDROGEO · yönetici özeti arka plan yenilemesi başarısız:",error?.message||error);}
  },1000);
}

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadAdmin(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadAdmin__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadAdmin__scroll(){
 return window.DG_LOAD_ADMIN_OVERVIEW.execute(PROFILE,{
  load:()=>window.DG_ADMIN_OVERVIEW_STORE.create(()=>sb).load(),
  summarize:window.DG_ADMIN_OVERVIEW_SUMMARY.summarize,
  updateMetrics:summary=>window.DG_ADMIN_OVERVIEW_METRICS_UI.render(summary,$),
  renderMeasurements:(response,rows)=>window.DG_ADMIN_OVERVIEW_MEASUREMENTS_UI.render(response,rows,{getElement:$,escape:esc,renderTable:dgRenderFlatTable}),
  refreshBasePanels:()=>{loadStorageStats();checkBackupReminder();loadVisitStats();loadRequests();loadAdminExportFilters();},
  refreshTree:()=>{if(typeof loadAdminTree==="function")loadAdminTree();},
  refreshParkAdmin:()=>{if(typeof loadParkAdmin==="function")loadParkAdmin();},
  refreshPublicationQueue:()=>{if(typeof dgLoadPublishQueue==="function")dgLoadPublishQueue();}
 });
}

async function approveMeas(id){
 // Compatibility contract: {status:"Onaylı",shared:true} is built by DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.
 const{error}=await window.DG_ADMIN_REVIEW_MEASUREMENT.review(sb,id,"Onaylı",true,window.DG_ADMIN_MODERATION_STORE);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt onaylandı","ok","✓");
 /* Canlı haritayı bayat işaretle (2026-09-26): onaylanan nokta Canlı Harita
  * sekmesine gidilince DG_LIVE_DIRTY kapısıyla yeniden çizilir (go("map")). */
 dgMarkLiveDirty();
 /* 0043 · İYİMSER ONAY (kullanıcı: "3-4 kaydı onaylarken sıçrama yaşıyorum,
  * bir sürü veri girilecek"). Eski akış her onayda loadAdmin→loadAdminTree ile
  * TÜM ağacı sunucudan yeniden çekiyor, ağaç "⏳ yükleniyor"a çöküp kaydırma
  * fırlıyordu. Yeni akış: satırı YEREL önbellekte güncelle + YERİNDE çiz
  * (anlık, ağ yok, sıçrama yok). Satır önbellekte yoksa (örn. düz listeden,
  * ağaç yüklenmeden) eski tam yükleme yedeğine düş. Sunucuyla tam mutabakat
  * sekmeli (debounced) arka plan tazelemesiyle ~1 sn içinde gelir. */
 if(typeof dgTreeApplyStatus!=="function"||!dgTreeApplyStatus(id,"Onaylı",true)){
  loadAdmin();loadWorld();
 }else{
  dgAdminSyncSoon();
 }
}

/* 🛰 KONUM ÇİTİ İSTİSNASI (0007): saha gerçeği poligonla çatışabilir (yeni
 * dikim alanı, OSM'de henüz olmayan park, kapalı bahçe). Yönetici istisna
 * işlerse satıra geo_override_by yazılır (audit) ve trigger çiti atlar.
 * Yetki sunucuda da denetlenir: tg_geo_fence → is_admin() yoksa 42501. */
async function dgGeoOverride(id){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
 if(!confirm(dgCf("Bu kayıt için KONUM ÇİTİ İSTİSNASI işlensin mi?\nSorumluluk işleyende; satıra audit izi (geo_override_by) yazılır.")))return;
 // Compatibility contract: geo_override_by:USER.id remains the audited server field.
 const{error}=await window.DG_ADMIN_OVERRIDE_MEASUREMENT_GEOFENCE.execute(sb,id,USER.id,window.DG_ADMIN_MODERATION_STORE);
 if(error)return toast("Hata: "+error.message,"err");
 toast("🛰 Konum istisnası işlendi (audit izi satırda)","ok","🛰");
 loadAdmin();
}

async function rejectMeas(id){
 // Compatibility contract: {status:"Red",shared:false} is built by DG_ADMIN_MEASUREMENT_REVIEW_PAYLOAD.
 const{error}=await window.DG_ADMIN_REVIEW_MEASUREMENT.review(sb,id,"Red",false,window.DG_ADMIN_MODERATION_STORE);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt reddedildi","warn","🚫");
 dgMarkLiveDirty();   /* red edilen nokta da haritadan düşmeli */
 /* 0043: iyimser red — yerinde güncelle (ağ yok, sıçrama yok); önbellekte
  * yoksa tam yüklemeye düş; tam mutabakat sekmeli arka plan tazelemesiyle. */
 if(typeof dgTreeApplyStatus!=="function"||!dgTreeApplyStatus(id,"Red",false)){
  loadAdmin();
 }else{
  dgAdminSyncSoon();
 }
}

async function loadStorageStats(){
 try{
  const adminStore=window.DG_ADMIN_PERSISTENCE_STORE.create(()=>sb);
  const usage=await window.DG_READ_PHOTO_STORAGE_USAGE.read(adminStore);
  window.DG_ADMIN_STORAGE_USAGE_UI.render($("storeBar"),$("storeInfo"),{...usage,quota:QUOTA_MB,format:_tadf});
 }catch(e){window.DG_ADMIN_STORAGE_USAGE_UI.unavailable($("storeInfo"),_tad("Depolama bilgisi alınamadı."));}
}

async function cleanOrphans(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.");
 if(!confirm(dgCf("Hiçbir kayda bağlı olmayan depolama dosyaları silinsin mi?")))return;
 const adminStore=window.DG_ADMIN_PERSISTENCE_STORE.create(()=>sb);
 let removed;
 try{removed=await window.DG_CLEAN_ORPHAN_PHOTOS.clean({ports:adminStore});}
 catch(error){return toast(_tad("Fotoğraf temizliği doğrulanamadı; silme durduruldu."),"err");}
 toast("✓ "+removed+" yetim dosya silindi.");
 loadStorageStats();
}

async function reGeocodeAll(){
 const flow=window.DG_RE_GEOCODE_MEASUREMENTS;
 const store=window.DG_ADMIN_RE_GEOCODE_STORE&&window.DG_ADMIN_RE_GEOCODE_STORE.create(()=>sb);
 const confirmation=window.DG_CONFIRM_ADMIN_RE_GEOCODE;
 const feedback=window.DG_ADMIN_RE_GEOCODE_FEEDBACK;
 return flow.execute({
  authorized:()=>!!PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"),
  confirm:()=>confirmation.ask(message=>confirm(message),message=>dgCf(message)),
  loadRows:()=>store.loadMeasurements(),
  isValidCoordinate:(lat,lon)=>Number.isFinite(+lat)&&Number.isFinite(+lon),
  reverse:(lat,lon)=>reverseGeocode(lat,lon),
  update:(id,fields)=>store.updatePlace(id,fields),
  wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  onDenied:()=>feedback.denied(toast),
  onComplete:count=>feedback.completed(toast,_tadf,count),
  refresh:()=>{loadWorld();loadAdmin();}
 });
}

async function delMeas(id){
 if(!confirm(dgCf("Kayıt silinsin mi?")))return;
 const{error}=await window.DG_ADMIN_DELETE_MEASUREMENT.execute(sb,id,removePhoto,window.DG_ADMIN_MODERATION_STORE);
 if(error)return toast("Hata: "+error.message,"err");
 dgMarkLiveDirty();
 /* 0043: iyimser silme — satırı önbellekten düş + yerinde çiz (sıçrama yok);
  * önbellekte yoksa tam yüklemeye düş; tam mutabakat sekmeli arka planla. */
 if(typeof dgTreeRemoveRow!=="function"||!dgTreeRemoveRow(id)){
  loadAdmin();
 }else{
  dgAdminSyncSoon();
 }
}

function filterAdminMeas(){
 return window.DG_ADMIN_MEASUREMENT_FILTER.apply($("adminMeasSearch").value,$("aMeasT"));
}

/* ============ GERÇEK ZAMANLI BAĞIMLI FİLTRELER (Ülke→Şehir→Proje) ============ */
let REQ_ROWS=[],REQ_PROJECTS=[],ADM_ROWS=[],ADM_PROJECTS=[];

function listCountries(rows,projects){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listCountries(rows,projects);
}

function listCities(rows,projects,country){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listCities(rows,projects,country);
}

function listProjects(projects,country,city,withId){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listProjects(projects,country,city,withId);
}

function fillSelect(sel,opts){
 return window.DG_FILL_ADMIN_EXPORT_SELECT.render(sel,opts,esc);
}

/* --- Yönetici paneli --- */
async function loadAdminExportFilters(){
 return window.DG_LOAD_ADMIN_EXPORT_FILTERS.execute({load:()=>window.DG_ADMIN_EXPORT_FILTER_STORE.create(()=>sb).load(),apply:(m,p)=>{ADM_ROWS=m.data||[];ADM_PROJECTS=p.data||[];fillSelect($("admExpCountry"),listCountries(ADM_ROWS,ADM_PROJECTS));admCountryChanged();}});
}

function admCountryChanged(){
 if(window.DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS)return window.DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS.countryChanged(ADM_ROWS,ADM_PROJECTS,$("admExpCountry").value,{listCities,fillCity:options=>fillSelect($("admExpCity"),options),cityChanged:()=>admCityChanged()});
 fillSelect($("admExpCity"),listCities(ADM_ROWS,ADM_PROJECTS,$("admExpCountry").value));
 admCityChanged();
}

function admCityChanged(){
 if(window.DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS)return window.DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS.cityChanged(ADM_PROJECTS,$("admExpCountry").value,$("admExpCity").value,{listProjects,fillProject:options=>fillSelect($("admExpProject"),options)});
fillSelect($("admExpProject"),listProjects(ADM_PROJECTS,$("admExpCountry").value,$("admExpCity").value,true));
}

/* --- TOPLU DIŞA AKTARIM (Admin) --- */
function adminFilteredQuery(){
return window.DG_BUILD_ADMIN_EXPORT_QUERY.build(window.DG_ADMIN_PERSISTENCE_STORE.create(()=>sb),{country:$("admExpCountry").value,city:$("admExpCity").value,project:$("admExpProject").value,status:$("admExpStatus").value});
}

async function adminFilteredRows(){
return window.DG_READ_ADMIN_EXPORT_ROWS.read(adminFilteredQuery);
}

async function adminExportCSV(){
if(window.DG_DOWNLOAD_ADMIN_MEASUREMENTS)return window.DG_DOWNLOAD_ADMIN_MEASUREMENTS.execute("csv",dgAdminExportPorts());
const rows=await adminFilteredRows();
if(!rows.length)return toast(_tad("Filtreye uyan kayıt yok"),"warn");
dl(fullCSV(rows),"dendrogeo_toplu.csv");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","📥");
}

async function adminExportQgis(){
if(window.DG_DOWNLOAD_ADMIN_MEASUREMENTS)return window.DG_DOWNLOAD_ADMIN_MEASUREMENTS.execute("qgis",dgAdminExportPorts());
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
dl(fullCSV(rows),"dendrogeo_qgis_detayli.csv");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","🧾");
}

async function adminExportGeo(){
if(window.DG_DOWNLOAD_ADMIN_MEASUREMENTS)return window.DG_DOWNLOAD_ADMIN_MEASUREMENTS.execute("geojson",dgAdminExportPorts());
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
const gj=window.DG_ADMIN_MEASUREMENT_GEOJSON.build(rows,LATIN);
dl(JSON.stringify(gj,null,2),"dendrogeo_toplu.geojson");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","🗺");
}
function dgAdminExportPorts(){return{read:()=>adminFilteredRows(),csv:rows=>fullCSV(rows),geojson:rows=>window.DG_ADMIN_MEASUREMENT_GEOJSON.build(rows,LATIN),download:(content,name)=>dl(content,name),onEmpty:format=>toast(format==="csv"?_tad("Filtreye uyan kayıt yok"):"Filtreye uyan kayıt yok","warn"),onSuccess:(format,count)=>toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:count}),"ok",format==="csv"?"📥":format==="qgis"?"🧾":"🗺")};}
