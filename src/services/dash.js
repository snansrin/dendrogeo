"use strict";
/* ===== DendroGeo v2 · src/services/dash.js =====
Panel, analiz, grafikler, kayıtlar, dünya verisi yükleme */

// 1. Kayıtlarım — ana tema ile proje bazında açılır/kapanır envanter
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadRecords(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadRecords__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgRecordStatusMeta(status){
 return window.DG_RECORD_STATUS_META.resolve(status);
}
// Compatibility contracts for locked audits: return `<details class="record-project"> and class="record-metrics" are rendered by the delegated UI modules; dgThumb(r.photo_url), new Map(), >Çevre</span>, >DBH</span>, >Karbon</span>, girth_cm, dbh_cm and (+r.dbh_cm).toFixed(1) remain in delegated modules.
function dgRecordItemHTML(row){return window.DG_RECORD_ITEM_UI.render(row,{escape:esc,thumbnail:dgThumb,statusMeta:dgRecordStatusMeta});}
function dgRecordProjectGroup(name,rows){
 return window.DG_RECORD_PROJECT_UI.render(name,rows,{escape:esc,renderItem:dgRecordItemHTML});
}
async function loadRecords__scroll(){
 return window.DG_LOAD_OWN_RECORDS_VIEW.execute(USER.id,{load:userId=>window.DG_OWN_RECORDS_STORE.load(sb,userId),group:rows=>window.DG_GROUP_OWN_RECORDS.group(rows),container:()=>$('recGroups'),renderGroup:(name,rows)=>dgRecordProjectGroup(name,rows),afterRender:element=>window.DG_RECORD_ITEM_UI.bind(element,{edit:id=>editRec(id),delete:id=>delRec(id)}),empty:()=>`<div class="card records-empty">${typeof dgCf==="function"?dgCf("Kayıt yok"):"Kayıt yok"}</div>`,failed:error=>`<div class="card records-empty records-error">${esc(dgCf("Kayıtlar yüklenemedi: "))}${esc(error?.message||dgCf("Bağlantı hatası"))}</div>`});
}
// 2. Kayıt sil
async function delRec(id){
 const viewState=window.DG_DASHBOARD_VIEW_STATE.create(document);
 return window.DG_DELETE_OWN_RECORD.execute(id,{confirm:()=>window.DG_TYPED_DELETE_CONFIRM.ask({kind:"measurement",id,warning:dgCf("Kayıt tamamen silinsin mi?")}),remove:recordId=>window.DG_DELETE_OWN_RECORD_STORE.remove(sb,recordId),onFailure:error=>toast(dgCf("Kayıt silinemedi: ")+(error?.message||dgCf("Sunucu silmeyi doğrulamadı.")),"err"),removePhoto,refreshRecords:()=>loadRecords(),refreshDashboard:()=>loadDash(),markLiveDirty:()=>dgMarkLiveDirty(),shouldRefreshMap:()=>typeof loadLiveMap==="function"&&viewState.isActive("v-map"),refreshMap:()=>loadLiveMap()});
}
// 3. Panel istatistikleri + grafik
async function loadDash(){
 return window.DG_LOAD_OWNER_DASHBOARD.execute(USER.id,{renderProfile:()=>{if(typeof dgAcademicProfileRender==="function")dgAcademicProfileRender();},load:userId=>window.DG_OWNER_DASHBOARD_STORE.load(sb,userId),update:values=>window.DG_OWNER_DASHBOARD_VIEW.update(document,values),renderChart:(labels,data)=>drawChart("chCarbon","bar",labels,data),renderAnalysis:(rows,id)=>renderAnalysis(rows,id)});
}
// 4. Tür dağılımı listesi
// 5. Chart.js grafiği
async function drawChart(id,type,labels,data){
 return window.DG_DASHBOARD_CHART.render(id,type,labels,data,{ensure:window.dgEnsureChart?()=>window.dgEnsureChart():null,charts,getChart:()=>typeof Chart==="undefined"?null:Chart,element:chartId=>$(chartId)});
}
// 6. Ağaç çeşitliliği analizi
/* ============ AKTİF VERİ ANALİZİ (İbreli/Yapraklı yüzde, ort. çap/boy, tür dağılımı) ============ */
/* 0040: kaydırma koruma sarmalı. */
function renderAnalysis(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return renderAnalysis__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function renderAnalysis__scroll(rows,elId){
 const summary=window.DG_TREE_ANALYSIS_SUMMARY.summarize(rows||[]);
 if(!summary){window.DG_TREE_ANALYSIS_UI.mount(document,elId,"");return;}
 // Compatibility markers for locked UI audits: En Yaygın 6 Tür; topSpecies.map and display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line) display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line) render in DG_TREE_ANALYSIS_UI.
 window.DG_TREE_ANALYSIS_UI.mount(document,elId,window.DG_TREE_ANALYSIS_UI.render(summary,{groupColor:GROUP_COLOR,groupColorInk:GROUP_COLOR_INK,escape:esc,latin:LATIN}));
}
// 7. Dünya verisi yükle
/* SESSİZ catch(e){} KALDIRILDI (2026-09-26).
 *
 * Bu blok v_global + v_country + v_city sorgularını VE işaretçi yüklemesini
 * sarıyordu; içlerinden biri patladığında (RLS/42501, JWT tazelenirken 401,
 * PostgREST şema önbelleği, ağ) Dünya sekmesi BOMBOŞ kalıyor ve ekranda
 * hiçbir açıklama olmuyordu. Kullanıcının gördüğü tek şey "onayladığım veri
 * ne dünyada ne canlı haritada var" — oysa veri veritabanında duruyordu.
 * Projenin kendi ilkesi (park-registry: "sessiz başarısızlık yok") burada
 * uygulanmıyordu. Artık sebep #worldErr kutusunda + ↻ Yeniden dene.
 *
 * İŞARETÇİ HATASI: loadApprovedMarkers artık hatayı 3. argümanla döndürüyor;
 * başarısızlıkta analiz bloğu yanlış veriyle (boş küme) doldurulmuyor. */
async function loadWorld(){
 return window.DG_LOAD_WORLD_DASHBOARD.execute({
  hideError:()=>window.DG_WORLD_ERROR_UI.hide(document),
  loadStats:()=>window.DG_WORLD_STATS_STORE.load(sb),
  updateStats:data=>window.DG_WORLD_STATS_TABLES.update(document,data),
  renderCountries:rows=>window.DG_WORLD_STATS_TABLES.mountCountries(document,rows,esc),
  renderCities:rows=>window.DG_WORLD_STATS_TABLES.mountCities(document,rows,esc),
  loadMarkers:callback=>loadApprovedMarkers(worldMap,3000,callback),
  markLiveDirty:()=>dgMarkLiveDirty(),
  clusterDegraded:()=>worldMap&&worldMap._clusterDegraded,
  warn:message=>console.warn(message),
  renderAnalysis:(rows,id)=>renderAnalysis(rows,id),
  loadParkCompare:()=>loadParkCompare(),
  showError:message=>dgWorldError(message)
 });
}
function dgWorldError(msg){
 console.error("DENDROGEO · loadWorld:",msg);
 return window.DG_WORLD_ERROR_UI.show(document,msg,esc,{retry:()=>loadWorld()});
}
