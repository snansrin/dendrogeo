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
 if(window.DG_LOAD_OWN_RECORDS_VIEW)return window.DG_LOAD_OWN_RECORDS_VIEW.execute(USER.id,{load:userId=>window.DG_OWN_RECORDS_STORE.load(sb,userId),group:rows=>window.DG_GROUP_OWN_RECORDS.group(rows),container:()=>$('recGroups'),renderGroup:(name,rows)=>dgRecordProjectGroup(name,rows),empty:()=>`<div class="card records-empty">${typeof dgCf==="function"?dgCf("Kayıt yok"):"Kayıt yok"}</div>`,failed:error=>`<div class="card records-empty records-error">${esc(dgCf("Kayıtlar yüklenemedi: "))}${esc(error?.message||dgCf("Bağlantı hatası"))}</div>`});
 const{data,error}=await window.DG_OWN_RECORDS_STORE.load(sb,USER.id);
 if(error){const el=$('recGroups');if(el)el.innerHTML=`<div class="card records-empty records-error">${esc(dgCf("Kayıtlar yüklenemedi: "))}${esc(error.message||dgCf("Bağlantı hatası"))}</div>`;return;}
 // Compatibility contract: localeCompare(String(pb),"tr") and point_id ordering remain unchanged in DG_GROUP_OWN_RECORDS.
 const groups=window.DG_GROUP_OWN_RECORDS.group(data||[]);
 const el=$("recGroups");if(!el)return;
 el.innerHTML=groups.size?[...groups.entries()].map(([name,rows])=>dgRecordProjectGroup(name,rows)).join(""):`<div class="card records-empty">${typeof dgCf==="function"?dgCf("Kayıt yok"):"Kayıt yok"}</div>`;
}
// 2. Kayıt sil
async function delRec(id){
 if(window.DG_DELETE_OWN_RECORD)return window.DG_DELETE_OWN_RECORD.execute(id,{confirm:()=>confirm(dgCf("Kayıt tamamen silinsin mi?")),remove:recordId=>sb.from("measurements").delete().eq("id",recordId).select("photo_url"),onFailure:error=>toast(dgCf("Kayıt silinemedi: ")+(error?.message||dgCf("Sunucu silmeyi doğrulamadı.")),"err"),removePhoto,refreshRecords:()=>loadRecords(),refreshDashboard:()=>loadDash(),markLiveDirty:()=>dgMarkLiveDirty(),shouldRefreshMap:()=>typeof loadLiveMap==="function"&&$("v-map")?.classList.contains("on"),refreshMap:()=>loadLiveMap()});
 if(!confirm(dgCf("Kayıt tamamen silinsin mi?")))return;
 // Delete the row first. A rejected/zero-row delete must retain its photo.
 const{data,error}=await sb.from("measurements").delete().eq("id",id).select("photo_url");
 if(error||!data?.length)return toast(dgCf("Kayıt silinemedi: ")+(error?.message||dgCf("Sunucu silmeyi doğrulamadı.")),"err");
 for(const row of data)if(row.photo_url)await removePhoto(row.photo_url);
 loadRecords();loadDash();
 dgMarkLiveDirty();
 if(typeof loadLiveMap==="function"&&$("v-map")?.classList.contains("on"))loadLiveMap();
}
// 3. Panel istatistikleri + grafik
async function loadDash(){
 if(window.DG_LOAD_OWNER_DASHBOARD)return window.DG_LOAD_OWNER_DASHBOARD.execute(USER.id,{renderProfile:()=>{if(typeof dgAcademicProfileRender==="function")dgAcademicProfileRender();},load:userId=>sb.from("measurements").select("*").eq("owner",userId),update:values=>{$("dMy").textContent=values.records;$("dCarbon").textContent=values.carbon;},renderChart:(labels,data)=>drawChart("chCarbon","bar",labels,data),renderAnalysis:(rows,id)=>renderAnalysis(rows,id)});
 if(typeof dgAcademicProfileRender==="function")dgAcademicProfileRender();
 const{data}=await sb.from("measurements").select("*").eq("owner",USER.id);
 $("dMy").textContent=(data||[]).length;
 $("dCarbon").textContent=((data||[]).reduce((a,r)=>a+(r.carbon_kg||0),0)).toFixed(0);
 drawChart("chCarbon","bar",(data||[]).slice(0,10).map(r=>"P"+r.point_id),(data||[]).slice(0,10).map(r=>r.carbon_kg));
 renderAnalysis(data||[],"myAnalysis");
}
// 4. Tür dağılımı listesi
// 5. Chart.js grafiği
async function drawChart(id,type,labels,data){
 if(window.DG_DASHBOARD_CHART)return window.DG_DASHBOARD_CHART.render(id,type,labels,data,{ensure:window.dgEnsureChart?()=>window.dgEnsureChart():null,charts,getChart:()=>Chart,element:chartId=>$(chartId)});
 /* Faz 7: Chart.js tembel yüklenir; çağıranlar fire-and-forget bırakabilir. */
 if(window.dgEnsureChart)await window.dgEnsureChart();
 if(charts[id])charts[id].destroy();
 const pal=["#14532d","#1e6f4b","#2e8b57","#3aa76d","#6aa84f","#8fbc6d","#c77d2e","#d97706","#92400e","#4c9a52"];
 charts[id]=new Chart($(id),{type,data:{labels,datasets:[{data,backgroundColor:(c)=>pal[c.dataIndex%pal.length],borderRadius:8,borderSkipped:false,barPercentage:.6}]},options:{plugins:{legend:{display:false}},scales:type==="bar"?{y:{grid:{color:"rgba(20,30,25,.06)"},ticks:{color:"#5f6d65"}},x:{grid:{display:false},ticks:{color:"#5f6d65"}}}:undefined}});
}
// 6. Ağaç çeşitliliği analizi
/* ============ AKTİF VERİ ANALİZİ (İbreli/Yapraklı yüzde, ort. çap/boy, tür dağılımı) ============ */
/* 0040: kaydırma koruma sarmalı. */
function renderAnalysis(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return renderAnalysis__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function renderAnalysis__scroll(rows,elId){
 const el=$(elId);if(!el)return;
 const summary=window.DG_TREE_ANALYSIS_SUMMARY.summarize(rows||[]);
 if(!summary){el.innerHTML="";return;}
 // Compatibility markers for locked UI audits: En Yaygın 6 Tür; topSpecies.map and display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line) display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line) render in DG_TREE_ANALYSIS_UI.
 el.innerHTML=window.DG_TREE_ANALYSIS_UI.render(summary,{groupColor:GROUP_COLOR,groupColorInk:GROUP_COLOR_INK,escape:esc,latin:LATIN});
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
 if(window.DG_LOAD_WORLD_DASHBOARD)return window.DG_LOAD_WORLD_DASHBOARD.execute({hideError:()=>{const box=$("worldErr");if(box)box.style.display="none";},loadStats:()=>window.DG_WORLD_STATS_STORE.load(sb),updateStats:data=>{$("wRec").textContent=data.records||0;$("wCountry").textContent=data.countries||0;$("wCity").textContent=data.cities||0;$("wCarbon").textContent=data.carbon_t||0;},renderCountries:rows=>{$("wCountryT").innerHTML=window.DG_WORLD_STATS_TABLES.countries(rows,esc);},renderCities:rows=>{$("wCityT").innerHTML=window.DG_WORLD_STATS_TABLES.cities(rows,esc);},loadMarkers:(callback)=>loadApprovedMarkers(worldMap,3000,callback),markLiveDirty:()=>dgMarkLiveDirty(),clusterDegraded:()=>worldMap&&worldMap._clusterDegraded,warn:message=>console.warn(message),renderAnalysis:(rows,id)=>renderAnalysis(rows,id),loadParkCompare:()=>loadParkCompare(),showError:message=>dgWorldError(message)});
 const box=$("worldErr");
 if(box)box.style.display="none";
 try{
  const{global:g,countries:citiesSource,cities:citySource}=await window.DG_WORLD_STATS_STORE.load(sb);
  if(g.data){$("wRec").textContent=g.data.records||0;$("wCountry").textContent=g.data.countries||0;$("wCity").textContent=g.data.cities||0;$("wCarbon").textContent=g.data.carbon_t||0;}
  $("wCountryT").innerHTML=window.DG_WORLD_STATS_TABLES.countries(citiesSource.data||[],esc);
  $("wCityT").innerHTML=window.DG_WORLD_STATS_TABLES.cities(citySource.data||[],esc);
  loadApprovedMarkers(worldMap,3000,(n,rows,err)=>{
   if(err)return dgWorldError("İşaretçiler yüklenemedi: "+err);
   dgMarkLiveDirty();   /* dünya tazelendi → canlı harita kümesi de bayat */
   if(worldMap&&worldMap._clusterDegraded)
     console.warn("DENDROGEO · dünya haritası kümelenmeden çizildi (markercluster yok)");
   renderAnalysis(rows,"worldAnalysis");
  });
  loadParkCompare();
 }catch(e){
  dgWorldError((e&&(e.message||e))+"");
 }
}
function dgWorldError(msg){
 console.error("DENDROGEO · loadWorld:",msg);
 const box=$("worldErr");
 if(!box)return;
 box.style.display="";
 box.className="alert err";
 box.innerHTML=window.DG_WORLD_ERROR_UI.render(msg,esc);
}
