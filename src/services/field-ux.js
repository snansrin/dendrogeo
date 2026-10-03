"use strict";
/* DendroGeo · field-ux.js · 2026-10-03
 *
 * Saha ölçeği düzeltmeleri:
 *  - 77–300 waypoint için tüm listeyi DOM'a basmak yerine sayfalı pencere,
 *  - iOS konum yardımını kalıcı kutu yerine uzun süreli toast,
 *  - yüzey incelemesinde gerçek aktif park kimliğini çözme,
 *  - Leaflet boyut değişiminde hizalama yenileme,
 *  - OSM'deki kapalı bina/havuz/su/otopark nesnelerini 10 m rasterı
 *    DEĞİŞTİRMEDEN vektör kanıt olarak inceleme katmanına ekleme.
 *
 * Bilimsel kırmızı çizgi: ham raster sınıfları ve rawCounts/rawAreas burada
 * değiştirilmez. Vektör nesneler yalnız kullanıcı inceleme katmanında alanı
 * geometrik olarak böler; kabul edilen sonuç acceptedAreas snapshot'ında
 * dondurulur.
 */
(function(){
 const FX=window.DG_FIELD_UX={version:"2026-10-03.1",wpPage:0,wpKey:"",wpReveal:null,autoFeatures:[],autoParkId:null,autoPromise:null,resizeObserver:null,surfaceInstalled:false};
 const cf=s=>typeof window.dgCf==="function"?window.dgCf(s):s;
 const safe=s=>typeof window.esc==="function"?window.esc(s):String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
 const $id=id=>document.getElementById(id);

 /* ------------------------------------------------------------------
  * 1) GPS / iPhone: kalıcı yardım kartı yerine uzun toast
  * ---------------------------------------------------------------- */
 function hideIosHint(){const h=$id("iosHint");if(h)h.style.display="none";}
 function fieldStartGps(){
  hideIosHint();
  const isIos=/iPhone|iPad|iPod/.test(navigator.userAgent||"");
  if(isIos&&typeof window.toast==="function"){
   window.toast("<b>iPhone kullanıcısı mısınız?</b><br>Konum sorulursa Safari için <b>Kullanırken İzin Ver</b> seçin. GPS doğruluğu oturana kadar birkaç saniye açık alanda bekleyin.","info","📍",8500);
  }
  const gpsMsg=(t,e)=>{const g=$id("gpsState");if(g){g.textContent=t;g.className="alert "+(e?"err":"info");}if(e&&typeof window.dgGpsBtnBusy==="function")window.dgGpsBtnBusy(false);};
  if(!navigator.geolocation)return gpsMsg("Tarayıcı konum desteklemiyor.",1);
  (async()=>{
   try{
    if(navigator.permissions&&navigator.permissions.query){
     const p=await navigator.permissions.query({name:"geolocation"});
     if(p.state==="denied")return gpsMsg("Konum izni reddedildi. Ayarlar→Safari→Konum.",1);
    }
   }catch(e){}
   gpsMsg("Konum alınıyor…",0);
   if(typeof window.dgGpsBtnBusy==="function")window.dgGpsBtnBusy(true);
   const opts={enableHighAccuracy:true,timeout:15000,maximumAge:0};
   const onOk=p=>{
    if(typeof window.dgGpsBtnBusy==="function")window.dgGpsBtnBusy(false);
    try{GPS=p.coords;}catch(e){window.GPS=p.coords;}
    if(typeof window.updGps==="function")window.updGps();
    if(typeof window.dgLiveSharePing==="function")window.dgLiveSharePing();
    if(typeof window.dgPresencePing==="function")window.dgPresencePing();
    if(typeof window.acquireWakeLock==="function")window.acquireWakeLock();
    navigator.geolocation.watchPosition(p2=>{
     try{GPS=p2.coords;}catch(e){window.GPS=p2.coords;}
     if(typeof window.updGps==="function")window.updGps();
     if(typeof window.dgLiveSharePing==="function")window.dgLiveSharePing();
     if(typeof window.dgPresencePing==="function")window.dgPresencePing();
    },()=>{},{...opts,maximumAge:1000});
   };
   const onErr=e=>{
    if(e.code===1)return gpsMsg("İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.",1);
    if(e.code===3){
     try{navigator.geolocation.getCurrentPosition(onOk,()=>gpsMsg("GPS başarısız: dışarıda tekrar deneyin.",1),opts);}catch(err){gpsMsg("GPS hatası.",1);}
     return;
    }
    gpsMsg("GPS hatası: "+(e.message||"bilinmiyor"),1);
   };
   try{navigator.geolocation.getCurrentPosition(onOk,onErr,opts);}catch(e){gpsMsg("Konum başlatılamadı.",1);}
  })();
 }
 if(typeof window.startGps==="function")window.startGps=fieldStartGps;
 hideIosHint();

 /* ------------------------------------------------------------------
  * 2) Waypoint: 300 kartı tek seferde çizme; görünür pencereyi çiz
  * ---------------------------------------------------------------- */
 function wpPageSize(){return matchMedia("(max-width: 760px)").matches?12:24;}
 function wpState(){
  const all=(typeof WP!=="undefined"&&Array.isArray(WP))?WP:[];
  const query=($id("wpSearch")?.value||"").trim().toLowerCase().replace(/^p/,"");
  const filter=$id("wpFilter")?.value||"all";
  const sort=$id("wpSort")?.value||"id";
  const key=query+"|"+filter+"|"+sort;
  let rows=all.filter(w=>String(w.wp_id).includes(query)&&(filter==="all"||(filter==="done"?w.visited:!w.visited)));
  const gps=(typeof GPS!=="undefined"&&GPS)?GPS:null;
  if(sort==="distance"&&gps&&typeof hav==="function")rows.sort((a,b)=>hav(gps.latitude,gps.longitude,a.lat,a.lon)-hav(gps.latitude,gps.longitude,b.lat,b.lon)||a.wp_id-b.wp_id);
  else rows.sort((a,b)=>a.wp_id-b.wp_id);
  if(key!==FX.wpKey){FX.wpKey=key;FX.wpPage=0;}
  if(FX.wpReveal!=null){const i=rows.findIndex(w=>String(w.id)===String(FX.wpReveal));if(i>=0)FX.wpPage=Math.floor(i/wpPageSize());FX.wpReveal=null;}
  const size=wpPageSize(),pages=Math.max(1,Math.ceil(rows.length/size));
  FX.wpPage=Math.max(0,Math.min(FX.wpPage,pages-1));
  return{all,rows,size,pages,page:FX.wpPage,start:FX.wpPage*size,end:Math.min(rows.length,(FX.wpPage+1)*size),gps};
 }
 function pagerHtml(st){
  if(st.rows.length<=st.size)return"";
  const prev=st.page>0,next=st.page<st.pages-1;
  return `<li class="waypoint-pager"><button type="button" class="btn sm ghost" onclick="dgWpPage(-1)" ${prev?"":"disabled"}>←</button><b>${st.start+1}–${st.end}</b><span> / ${st.rows.length}</span><button type="button" class="btn sm ghost" onclick="dgWpPage(1)" ${next?"":"disabled"}>→</button></li>`;
 }
 function fieldRenderWaypoints(){
  const list=$id("wpListTable"),dWp=$id("dWp"),dVisit=$id("dVisit"),info=$id("navInfo");if(!list)return;
  const st=wpState(),done=st.all.filter(w=>w.visited).length;
  if(dWp)dWp.textContent=st.all.length;if(dVisit)dVisit.textContent=done;
  if(info)info.textContent=st.all.length+" nokta · "+(st.all.length-done)+" bekleyen · "+done+" tamamlanan. Arama ile P numarasına doğrudan gidin; listede yalnız görünür bölüm yüklenir.";
  const openCoordinates=new Set(Array.from(list.querySelectorAll?.("details[open]")||[],el=>el.getAttribute("data-wp-id")));
  const visible=st.rows.slice(st.start,st.end);
  const body=visible.map(w=>{
   const dist=st.gps&&typeof hav==="function"?Math.round(hav(st.gps.latitude,st.gps.longitude,w.lat,w.lon))+" m":"—";
   const current=(typeof navTarget!=="undefined"&&navTarget?.id===w.id);
   return `<li class="waypoint-point ${w.visited?"done":""}"${current?' aria-current="true"':''}><div class="waypoint-point-head"><b>P${Number(w.wp_id)}</b><span class="mono waypoint-distance">${dist}</span></div><div class="waypoint-point-actions"><span>${w.visited?'<span class="badge on">✓ '+safe(cf("Yapıldı"))+'</span>':'<span class="badge admin">'+safe(cf("Bekliyor"))+'</span>'}</span><div data-label="${safe(cf("İşlem"))}">${w.visited?"":`<button class="btn sm blue" onclick="selectWaypoint(${Number(w.id)})">🎯 ${safe(cf("Hedef"))}</button>`}</div></div><details class="waypoint-coordinates" data-wp-id="${Number(w.id)}"${openCoordinates.has(String(w.id))?" open":""}><summary>${safe(cf("Koordinatlar"))}</summary><div><span data-label="${safe(cf("Enlem"))}">${safe(cf("Enlem"))}: ${Number(w.lat).toFixed(6)}</span><span data-label="${safe(cf("Boylam"))}">${safe(cf("Boylam"))}: ${Number(w.lon).toFixed(6)}</span></div></details></li>`;
  }).join("");
  const empty=st.rows.length?"":`<li class="waypoint-empty">${st.all.length?safe(cf("Aramaya uygun nokta yok.")):((+$id("nProject")?.value)?safe(cf("Bu projede waypoint yok. CSV yükleyin.")):safe(cf("Önce proje seçin.")))}</li>`;
  const pager=pagerHtml(st);
  list.innerHTML=pager+body+empty+(pager?pager:"");
 }
 window.dgWpPage=function(delta){FX.wpPage+=Number(delta)||0;fieldRenderWaypoints();$id("wpListTable")?.scrollIntoView({block:"nearest"});};
 if(typeof window.renderWaypointList==="function")window.renderWaypointList=fieldRenderWaypoints;
 if(typeof window.selectWaypoint==="function"){
  const select0=window.selectWaypoint;
  window.selectWaypoint=function(id){FX.wpReveal=id;const r=select0.apply(this,arguments);queueMicrotask(()=>fieldRenderWaypoints());return r;};
 }
 for(const id of ["wpSearch","wpFilter","wpSort"]){const el=$id(id);if(el&&!el.dataset.dgPaged){el.dataset.dgPaged="1";el.addEventListener(id==="wpSearch"?"input":"change",()=>{FX.wpPage=0;fieldRenderWaypoints();});}}

 /* ------------------------------------------------------------------
  * 3) Yüzey incelemesi: park kimliği + gerçek nesne maskeleri + map resize
  * ---------------------------------------------------------------- */
 function activePark(){
  try{if(typeof DG_PARK!=="undefined"&&DG_PARK&&DG_PARK.id)return{id:DG_PARK.id,name:DG_PARK.name||""};}catch(e){}
  const ids=[$id("mProject")?.value,$id("nProject")?.value].filter(Boolean).map(Number);
  try{
   const list=(typeof PROJ_LIST!=="undefined"&&Array.isArray(PROJ_LIST))?PROJ_LIST:[];
   for(const id of ids){const p=list.find(x=>Number(x.id)===id&&x.park_id);if(p)return{id:p.park_id,name:p.park_name||p.name||""};}
   const linked=list.filter(p=>p.park_id);if(linked.length===1)return{id:linked[0].park_id,name:linked[0].park_name||linked[0].name||""};
  }catch(e){}
  return{id:null,name:""};
 }
 function invalidateMap(){
  if(typeof map==="undefined"||!map||typeof map.invalidateSize!=="function")return;
  requestAnimationFrame(()=>{try{map.invalidateSize({pan:false,animate:false});}catch(e){}});
  setTimeout(()=>{try{map.invalidateSize({pan:false,animate:false});}catch(e){}},90);
  setTimeout(()=>{try{map.invalidateSize({pan:false,animate:false});}catch(e){}},260);
 }
 function observeMap(){
  const el=$id("map");if(!el||!("ResizeObserver" in window)||FX.resizeObserver)return;
  let raf=0;FX.resizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(invalidateMap);});FX.resizeObserver.observe(el);
 }
 function osmBBox(){
  try{const rings=(typeof PARK_POLY!=="undefined"&&PARK_POLY)||[];let minLat=90,maxLat=-90,minLon=180,maxLon=-180;for(const r of rings)for(const p of r){minLat=Math.min(minLat,+p[0]);maxLat=Math.max(maxLat,+p[0]);minLon=Math.min(minLon,+p[1]);maxLon=Math.max(maxLon,+p[1]);}return minLat<maxLat&&minLon<maxLon?[minLat,minLon,maxLat,maxLon].join(","):null;}catch(e){return null;}
 }
 function cleanRing(geom){
  const r=(geom||[]).filter(g=>Number.isFinite(+g?.lat)&&Number.isFinite(+g?.lon)).map(g=>[+g.lon,+g.lat]);
  if(r.length>3&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1])r.pop();
  return r;
 }
 function objType(t){
  if(String(t?.leisure||"")==="swimming_pool")return"pool";
  if(t?.building||t?.["building:part"])return"building";
  if(String(t?.natural||"")==="water"||String(t?.waterway||"")==="riverbank"||String(t?.landuse||"")==="basin")return"water";
  if(String(t?.amenity||"")==="parking"||t?.["area:highway"]||String(t?.area||"")==="yes"&&t?.highway)return"hard";
  return null;
 }
 async function hashText(s){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");}catch(e){return null;}}
 async function fetchObjects(parkId){
  const bbox=osmBBox();if(!bbox)return[];
  const q=`[out:json][timeout:45];(way["building"](${bbox});way["building:part"](${bbox});way["natural"="water"](${bbox});way["waterway"="riverbank"](${bbox});way["leisure"="swimming_pool"](${bbox});way["landuse"="basin"](${bbox});way["amenity"="parking"](${bbox});way["area:highway"](${bbox});way["highway"]["area"="yes"](${bbox}););out tags geom;`;
  const mirrors=["https://overpass.openstreetmap.fr/api/interpreter","https://overpass.private.coffee/api/interpreter","https://overpass.kumi.systems/api/interpreter","https://overpass-api.de/api/interpreter","https://lz4.overpass-api.de/api/interpreter"];
  let data=null;
  for(const url of mirrors){try{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:"data="+encodeURIComponent(q),signal:AbortSignal.timeout(30000)});if(r.ok){data=await r.json();break;}}catch(e){}}
  const groups={hard:[],building:[],water:[],pool:[]};
  for(const el of data?.elements||[]){if(el.type!=="way")continue;const type=objType(el.tags||{}),ring=cleanRing(el.geometry);if(!type||!window.DG_SURFACE_REVIEW?.validRing(ring))continue;groups[type].push({type,ring,method:"osm-object",source:"OSM",osmId:"way/"+el.id,ts:new Date().toISOString()});}
  const out=[...groups.hard,...groups.building,...groups.water,...groups.pool];
  const fp=await hashText(out.map(f=>[f.type,f.osmId,f.ring]).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).map(JSON.stringify).join("|"));
  const state=window.DG_LC_SENS?.state;if(state?.record&&String(state.record.parkId)===String(parkId))state.record.objectFingerprint=fp;
  return out;
 }
 function withAuto(fn){
  const s=window.DG_LC_SENS?.state,rec=s?.record;if(!rec||!FX.autoFeatures.length)return fn();
  const manual=rec.features;rec.features=[...FX.autoFeatures,...(manual||[])];try{return fn();}finally{rec.features=manual;}
 }
 function installSurface(){
  if(FX.surfaceInstalled||!window.DG_SURFACE_REVIEW||!window.DG_LC_SENS)return;FX.surfaceInstalled=true;
  const R=window.DG_SURFACE_REVIEW;
  if(R.types.building)R.types.building.group="building";
  if(R.types.pool)R.types.pool.group="pool";
  window.dgSensParkId=activePark;
  window.dgSensNewRecord=function(){const pk=activePark(),owner=typeof USER!=="undefined"?USER?.id:null;return{id:"surface-"+(owner||"guest")+"-"+(pk.id||"x"),owner,parkId:pk.id,parkName:pk.name,sens:{green:50,water:50,hard:50,bare:50},corrections:{},features:[],profile:null,period:"latest",createdAt:new Date().toISOString()};};
  const areas0=window.dgSensAreas;
  if(typeof areas0==="function")window.dgSensAreas=function(){const s=window.DG_LC_SENS?.state;if(s?.record?.acceptedAt&&!s.editing&&s.record.acceptedAreas)return JSON.parse(JSON.stringify(s.record.acceptedAreas));return withAuto(()=>areas0.apply(this,arguments));};
  const refresh0=window.dgSensRefreshLayer;
  if(typeof refresh0==="function")window.dgSensRefreshLayer=function(){return withAuto(()=>refresh0.apply(this,arguments));};
  const mount0=window.DG_LC_SENS.mount;
  window.DG_LC_SENS.mount=async function(){
   const r=await mount0.apply(this,arguments);invalidateMap();observeMap();
   const pk=activePark();FX.autoFeatures=[];FX.autoParkId=pk.id;
   if(pk.id){
    FX.autoPromise=fetchObjects(pk.id).then(fs=>{if(String(FX.autoParkId)!==String(pk.id))return;FX.autoFeatures=fs;const s=window.DG_LC_SENS?.state;if(s?.record?.acceptedAt&&!s.editing){s.status=cf("Kayıtlı sonuç korunuyor. OSM nesne sınırları yalnız harita referansıdır.");}else if(fs.length){s.status=fs.length+" "+cf("gerçek OSM nesne sınırı (bina/su/havuz/sert alan) incelemeye eklendi.");}if(typeof window.dgSensRefreshLayer==="function")window.dgSensRefreshLayer();if(typeof window.dgSensUpdateSummary==="function")window.dgSensUpdateSummary();if(typeof window.dgSensUpdateStatus==="function")window.dgSensUpdateStatus();}).catch(()=>{FX.autoFeatures=[];});
   }
   return r;
  };
  window.dgSensMount=window.DG_LC_SENS.mount;
  const cleanup0=window.DG_LC_SENS.cleanup;
  window.DG_LC_SENS.cleanup=function(){FX.autoParkId=null;FX.autoFeatures=[];FX.autoPromise=null;const r=cleanup0.apply(this,arguments);invalidateMap();return r;};
  window.dgSensCleanup=window.DG_LC_SENS.cleanup;
  const accept0=window.dgSensAccept;
  if(typeof accept0==="function")window.dgSensAccept=async function(){if(FX.autoPromise){try{await FX.autoPromise;}catch(e){}}return accept0.apply(this,arguments);};
 }
 const ensure0=window.dgEnsureLulc;
 if(typeof ensure0==="function")window.dgEnsureLulc=function(){return ensure0.apply(this,arguments).then(v=>{installSurface();return v;});};
 observeMap();

 /* Test yardımcıları: üretim davranışına dokunmadan saf sayfalama denetimi. */
 FX.testPage=(n,page,size)=>({start:Math.max(0,page)*size,end:Math.min(n,(Math.max(0,page)+1)*size),pages:Math.max(1,Math.ceil(n/size))});
})();
