"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tmf=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tmff=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ===== DendroGeo v2 · src/services/map.js =====
Harita init, marker yönetimi, waypoint CRUD, navigasyon çizimi */

/* KOORDİNAT DOĞRULAMASI (2026-09-26).
 *
 * ESKİ KOD:  rows=(data||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
 * Tuzak: +null === 0 ve +"" === 0, Number.isFinite(0) ise TRUE. Yani lat/lon'u
 * NULL ya da boş string gelen bir kayıt "geçerli" sayılıp (0,0) noktasına —
 * Gine Körfezi'ndeki meşhur "Null Island"a — çiziliyor, üstelik küme
 * rozetine ve renderAnalysis yüzdelerine gerçek bir ağaç gibi giriyordu.
 * (Test bu davranışı yakaladı: 2 geçerli + 2 bozuk satır → 3 işaretçi.)
 * Artık boş değer reddedilir ve küresel sınır kontrolü yapılır. Tam (0,0)
 * da reddedilir: gerçek bir envanter noktası olması fiilen imkânsız. */
function dgValidCoord(lat,lon){
 return window.DG_MAP_COORDINATE.isValid(lat,lon);
}

// 1. Marker HTML üretici
function popupHtml(r){
 return window.DG_MAP_MEASUREMENT_POPUP.render(r,{escapeHTML:esc,translate:s=>typeof dgT==="function"?dgT(s):s});
}
// 2. Marker yükleme (chunked)
/* İDEMPOTENT (2026-09-26 · canlı tarayıcıda ölçüldü): küme zaten varsa ÖNCE
 * clearLayers() çağrılır.
 *
 * ESKİ DAVRANIŞ (hata): loadWorld() hem startShell'de hem her approveMeas'ta
 * hem park-registry'den çalışıyor; loadLiveMap() da sekme her açıldığında
 * çağrılabiliyordu. addMarkersChunked küme varsa YENİDEN EKLEDİĞİ için aynı
 * 12 kayıt kümeye 2., 3. kez biniyordu. Ölçüm (gerçek Chrome, canlı site):
 *   1. loadWorld → cluster 12 işaretçi, rozet "12"
 *   2. loadWorld → cluster 24 işaretçi, rozet "24"   ← yanlış sayı
 *   3. onay başına +12 …
 * Belirti kullanıcıya iki şekilde dönüyordu: "onayladığım kayıt haritada yok"
 * (rozet/istatistik tutarsız) ve tür-karbon analizinin iki kez sayılması.
 *
 * TOKEN: chunk'lar setTimeout(step,16) ile parça parça eklendiği için iki
 * yükleme çakışırsa ESKİ turun kalan chunk'ları clearLayers()'dan SONRA da
 * eklenmeye devam ederdi. Her yükleme m._markerToken'ı artırır; bayat tur
 * ilk adımında kendini iptal eder. */
function addMarkersChunked(m,rows,chunk=150){
 return window.DG_MAP_MEASUREMENT_MARKERS.add(m,rows,chunk,{leaflet:L,popupHTML:popupHtml,log:console,setTimer:setTimeout});
}
// 3. Onaylı marker'ları getir
/* HATA ARTIK SESSİZ DEĞİL (2026-09-26).
 *
 * ESKİ KOD: doğrudan veri sorgusunun hatası YOKSAYILIYORDU
 *            ...
 *            }catch(e){done&&done(0,[]);}
 *
 * İki ayrı yol "boş harita"yı BAŞARI gibi gösteriyordu:
 *   1) Sorgu error dönerse (RLS/42501, PostgREST şema önbelleği, JWT
 *      tazelenirken 401, ağ kopması) data=null → rows=[] → done(0,[]) →
 *      ekranda YEŞİL "✓ 0 onaylı kayıt yüklendi" kutusu.
 *   2) addMarkersChunked fırlatırsa (ör. markercluster eklentisi yüklenmedi)
 *      catch yutuyor → yine done(0,[]) → yine sahte yeşil.
 * Kullanıcı "verim silindi mi?" diye bunu bildirdi; oysa veri veritabanında
 * duruyordu. Artık done(n,rows,err) hata metnini 3. argümanla taşır ve
 * başarısızlıkta n=-1 olur; çağıranlar kırmızı kutu + ↻ düğmesi gösterir.
 *
 * İMZA GERİYE UYUMLU: err argümanını okumayan eski çağıranlar çalışmaya
 * devam eder (n=-1'i 0 gibi görürler); ama repo içindeki üç çağıran da
 * (loadLiveMap, loadWorld, initLanding) güncellendi. */
async function loadApprovedMarkers(m,limit,done){
 const app=window.DG_LOAD_APPROVED_MEASUREMENT_MARKERS,adapter=window.DG_FETCH_APPROVED_MAP_MEASUREMENTS,prepare=window.DG_PREPARE_APPROVED_MAP_MEASUREMENTS;
 return app.load({map:m,limit,done,readRows:()=>adapter.fetch({client:sb,limit,warnIfTruncated:dgWarnIfTruncated}),prepare:rows=>prepare.prepare(rows,dgValidCoord),draw:(target,rows)=>addMarkersChunked(target,rows),log:console});
}
// 4. Canlı harita
/* İDEMPOTENT + TAZELENEBİLİR (2026-09-26).
 *
 * BİLDİRİLEN HATA: "son yüklenen veriyi onaylamama rağmen canlı haritada
 * göremiyorum." Kök neden burası değil, ui/shell.js'teki kapıydı:
 *   if(!liveLoaded){liveLoaded=true;loadLiveMap();}
 * Yani Canlı Harita sekmesi bir oturumda YALNIZ BİR KEZ yükleniyordu;
 * approveMeas() loadWorld()'ü tazelese de canlı haritayı tazelemiyordu.
 * Kullanıcı onaydan sonra sekmeye dönünce ESKİ işaretçi kümesini görüyor,
 * F5 atmadan yenisini göremiyordu.
 *
 * ÇÖZÜM: liveLoaded + DG_LIVE_DIRTY. Onay/red/silme ve çevrimdışı
 * senkronizasyon dgMarkLiveDirty() çağırır; go("map") bayrağı görünce
 * yeniden çeker. Elle tazelemek için karta ↻ düğmesi kondu (partials/shell.html). */
async function loadLiveMap(){
 const app=window.DG_LOAD_LIVE_MEASUREMENTS_MAP,status=window.DG_RENDER_LIVE_MAP_LOAD_STATUS;
 const format=typeof dgTf==="function"?dgTf:(_t,v)=>_t.replace(/\{(\w+)\}/g,(match,key)=>v[key]);
 return app.load({element:$("mapLoad"),loadMarkers:callback=>loadApprovedMarkers(map,3000,callback),markLoaded:ok=>dgMarkLiveLoaded(ok),status,escapeHTML:esc,format,setTimer:setTimeout,clusterDegraded:()=>map&&map._clusterDegraded,renderAnalysis,retry:()=>loadLiveMap()});
}
/* liveLoaded/DG_LIVE_DIRTY ui/state.js'te (body sonunda) bildiriliyor; bu
 * fonksiyon yalnız ÇAĞRI ANINDA dokunduğu için yükleme sırası sorun değil.
 * try/catch: harness/birim testlerde state.js yüklenmeyebilir. */
function dgMarkLiveLoaded(ok){
 try{liveLoaded=true;DG_LIVE_DIRTY=false;}catch(e){}
}
function dgMarkLiveDirty(){
 try{DG_LIVE_DIRTY=true;}catch(e){}
}
// 5. Harita başlatma
function initMaps(){
 const views=window.DG_MAP_INITIAL_VIEW,creator=window.DG_CREATE_OSM_MAP,layer=window.DG_ADD_OSM_MAP_LAYER,instance=window.DG_INITIALIZE_MAP_INSTANCE,workspaces=window.DG_INITIALIZE_WORKSPACE_MAPS;
 if(views&&creator&&layer&&instance&&workspaces){workspaces.initialize([{name:"map",container:"map",attribution:DG_ATTR.osm,getMap:()=>map,setMap:value=>{map=value;}},{name:"navMap",container:"navMap",attribution:DG_ATTR.osm,getMap:()=>navMap,setMap:value=>{navMap=value;}},{name:"worldMap",container:"worldMap",attribution:DG_ATTR.osm,getMap:()=>worldMap,setMap:value=>{worldMap=value;}}],entry=>{const view=views.resolve(entry.name);instance.initialize({getMap:entry.getMap,setMap:entry.setMap,create:()=>creator.create({leaflet:L,container:entry.container,...view}),addLayer:target=>layer.add({leaflet:L,map:target,attribution:entry.attribution})});});return;}
 const osmAttribution=DG_ATTR.osm;
 /* ODbL: her OSM karosu katmanında attribution zorunlu (eski hâlde yoktu). */
 if(!map){map=L.map("map").setView([39.99,32.65],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:osmAttribution,maxZoom:19}).addTo(map);}
 if(!navMap){navMap=L.map("navMap").setView([39.992,32.6498],15);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:osmAttribution,maxZoom:19}).addTo(navMap);}
 if(!worldMap){worldMap=L.map("worldMap").setView([39,35],3);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:osmAttribution,maxZoom:19}).addTo(worldMap);}
}
// 6. Waypoint CRUD
async function uploadWpCsv(){
 const uploader=window.DG_UPLOAD_WAYPOINT_CSV,parser=window.DG_PARSE_WAYPOINT_CSV,validator=window.DG_VALIDATE_WAYPOINT_CSV_ROW,command=window.DG_BUILD_WAYPOINT_UPSERT_COMMAND,store=window.DG_UPSERT_PROJECT_WAYPOINT;
 const pid=+$("nProject").value;if(!pid)return toast("Proje seç");
 const f=$("nCsv").files[0];if(!f)return toast("CSV seç");
 if(uploader&&parser&&validator&&command&&store){await uploader.upload({projectId:pid,file:f,owner:USER.id,parse:parser.parse,validate:validator.validate,build:command.build,upsert:input=>store.upsert({client:sb,command:input}),notify:(message,kind)=>toast(message,kind),refresh:loadWaypoints,translate:dgCf});return;}
 let n=0,invalid=0;
 try{
  const lines=(await f.text()).replace(/^\uFEFF/,"").split(/\r?\n/);
  for(let i=1;i<lines.length;i++){
   if(!lines[i].trim())continue;
   const c=lines[i].split(",").map(v=>v.trim().replace(/^"|"$/g,""));
   const lon=Number(c[0]),lat=Number(c[1]),id=Number(c[2]);
   if(c.length<3||!c[0]||!c[1]||!Number.isInteger(id)||id<=0||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){invalid++;continue;}
   await window.DG_UPSERT_PROJECT_WAYPOINT.upsert({client:sb,command:{row:{owner:USER.id,project_id:pid,wp_id:id,lat,lon},options:{onConflict:"project_id,wp_id"}}});
   n++;
  }
  toast("✓ "+n+" ölçüm noktası kaydedildi."+(invalid?" "+invalid+" geçersiz satır atlandı.":""),invalid?"warn":"ok");
 }catch(e){toast(dgCf("Ölçüm noktası yükleme hatası:")+" "+e.message+" · "+n+" satır kaydedildi.","err");}
 await loadWaypoints();
}
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadWaypoints(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadWaypoints__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadWaypoints__scroll(){
 const pid=+$("nProject").value;
 const previousTarget=navTarget;
 const loader=window.DG_LOAD_PROJECT_WAYPOINTS,store=window.DG_FETCH_PROJECT_WAYPOINTS,selection=window.DG_SELECT_RESTORED_WAYPOINT_TARGET,reset=window.DG_RESET_WAYPOINT_LOAD_STATE,errorUI=window.DG_SHOW_WAYPOINT_LOAD_ERROR;
 if(loader&&store&&selection&&reset&&errorUI){await loader.load({projectId:pid,getProjectId:()=>+$('nProject').value,previousTarget,reset:()=>reset.reset({clear:()=>{WP=[];navTarget=null;drawNav();},hasProject:!!pid,renderEmpty:renderWaypointList}),readProject:projectId=>store.fetch({client:sb,projectId}),selectTarget:(rows,target)=>selection.select(rows,target),setWaypoints:rows=>{WP=rows;},setTarget:target=>{navTarget=target;},draw:drawNav,showError:error=>errorUI.show({error,notify:toast,translate:dgCf})});return;}
 WP=[];navTarget=null;drawNav();
 if(!pid){renderWaypointList();return;}
 try{
  const{data,error}=await window.DG_FETCH_PROJECT_WAYPOINTS.fetch({client:sb,projectId:pid});
  if(+$("nProject").value!==pid)return;
  if(error)throw error;
  WP=data||[];
  navTarget=WP.find(w=>w.id===previousTarget?.id&&!w.visited)||null;
  drawNav();
 }catch(e){toast(dgCf("Ölçüm noktası listesi alınamadı:")+" "+e.message,"err");}
}
let DG_WP_PAGE=0,DG_WP_QUERY="";
const DG_WP_PAGE_SIZE=8;
function dgWaypointPage(delta){DG_WP_PAGE+=delta;renderWaypointList();}
function renderWaypointList(){
 return window.DG_WAYPOINT_LIST_UI.renderTo({
  getElement:$,waypoints:WP,gps:GPS,projectId:$("nProject").value,
  search:$("wpSearch")?.value,filter:$("wpFilter")?.value||"all",sort:$("wpSort")?.value||"id",
  page:DG_WP_PAGE,signature:DG_WP_QUERY,selectedId:navTarget?.id,
  distance:hav,setPage:value=>{DG_WP_PAGE=value;},setSignature:value=>{DG_WP_QUERY=value;},
  actions:{page:dgWaypointPage,select:selectWaypoint}
 });
}

async function deleteAllWaypoints(){
 const pid=+$("nProject").value;
 const app=window.DG_DELETE_PROJECT_WAYPOINTS_USE_CASE,selected=window.DG_IS_WAYPOINT_PROJECT_SELECTED,confirmation=window.DG_CONFIRM_WAYPOINT_LIST_DELETION,store=window.DG_DELETE_PROJECT_WAYPOINTS,completion=window.DG_CLEAR_DELETED_WAYPOINT_LIST;
 if(app&&selected&&confirmation&&store&&completion){await app.execute({projectId:pid,isSelected:selected.isSelected,confirmDeletion:()=>confirmation.confirm({confirm,translate:dgCf}),remove:projectId=>store.delete({client:sb,projectId}),showError:error=>toast("Hata: "+error.message,"err"),complete:()=>completion.clear({setTarget:value=>{navTarget=value;},setWaypoints:value=>{WP=value;},notify:toast,refresh:loadWaypoints}),notify:toast});return;}
 if(!pid)return toast("Proje seç");
 if(!confirm(dgCf("⚠ Bu projedeki TÜM ölçüm noktaları kalıcı olarak silinsin mi? Yanlış liste ise sonra yeniden yükleyebilirsiniz.")))return;
 const{error}=await window.DG_DELETE_PROJECT_WAYPOINTS.delete({client:sb,projectId:pid});
 if(error)return toast("Hata: "+error.message,"err");
 navTarget=null;WP=[];
 toast("✓ Liste tamamen silindi. Yeni CSV yükleyebilirsiniz.");
 loadWaypoints();
}
async function selectWaypoint(id){
 if(window.DG_SELECT_WAYPOINT)return window.DG_SELECT_WAYPOINT.select({
  waypoints:WP,id,setTarget:point=>{navTarget=point;},isManual:()=>manualPoint,
  pointInput:()=>$("mPoint"),draw:()=>drawNav(),focus:()=>dgFocusWaypoint()
 });
 const w=WP.find(x=>x.id===id);if(!w)return;
 navTarget=w;
 if(!manualPoint)$("mPoint").value=w.wp_id;
 drawNav();
 dgFocusWaypoint();
}
// Navigation actions select targets only; arrival retains the existing visit/save flow.
function dgNearestWaypoint(){
 if(window.DG_SELECT_NEAREST_WAYPOINT&&window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI&&window.DG_WAYPOINT_TARGET){return window.DG_SELECT_NEAREST_WAYPOINT.select({waypoints:WP,gps:GPS,distance:hav,nearest:(rows,gps,distance)=>window.DG_WAYPOINT_TARGET.nearest(rows,gps,distance),onGpsRequired:()=>window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI.gpsRequired({translate:dgCf,notify:toast,startGps:()=>typeof startGps==="function"?startGps():null}),onEmpty:()=>window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI.noPending({translate:dgCf,notify:toast}),onSelect:id=>selectWaypoint(id)});}
 if(!GPS){toast(dgCf("En yakın noktayı seçmek için önce konumu etkinleştirin."),"warn","📡");try{if(typeof startGps==="function")startGps();}catch(e){}return;}
 if(window.DG_WAYPOINT_TARGET){const nearest=window.DG_WAYPOINT_TARGET.nearest(WP,GPS,hav);if(!nearest)return toast(dgCf("Bekleyen ölçüm noktası kalmadı."),"info");return selectWaypoint(nearest.id);}
 const pending=WP.filter(w=>!w.visited);
 if(!pending.length)return toast(dgCf("Bekleyen ölçüm noktası kalmadı."),"info");
 const nearest=pending.reduce((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)<=hav(GPS.latitude,GPS.longitude,b.lat,b.lon)?a:b);
 selectWaypoint(nearest.id);
}
function dgNextWaypoint(){
 if(window.DG_ADVANCE_WAYPOINT_TARGET&&window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI&&window.DG_WAYPOINT_TARGET){return window.DG_ADVANCE_WAYPOINT_TARGET.advance({waypoints:WP,currentId:navTarget?.wp_id??-Infinity,next:(rows,currentId)=>window.DG_WAYPOINT_TARGET.next(rows,currentId),onEmpty:()=>window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI.noPending({translate:dgCf,notify:toast}),onSelect:id=>selectWaypoint(id)});}
 if(window.DG_WAYPOINT_TARGET){const next=window.DG_WAYPOINT_TARGET.next(WP,navTarget?.wp_id??-Infinity);if(!next)return toast(dgCf("Bekleyen ölçüm noktası kalmadı."),"info");return selectWaypoint(next.id);}
 const pending=WP.filter(w=>!w.visited).sort((a,b)=>a.wp_id-b.wp_id);
 if(!pending.length)return toast(dgCf("Bekleyen ölçüm noktası kalmadı."),"info");
 const next=pending.find(w=>w.wp_id>(navTarget?.wp_id??-Infinity))||pending[0];
 selectWaypoint(next.id);
}
function dgFocusWaypoint(showMap=false){
 if(window.DG_WAYPOINT_MAP_VIEWPORT)return window.DG_WAYPOINT_MAP_VIEWPORT.focus({showMap,map:navMap,target:navTarget,gps:GPS,panel:showMap?$("wpMapPanel"):null});
 if(showMap){const p=$("wpMapPanel");if(p)p.open=true;if(navMap?.invalidateSize)navMap.invalidateSize();}
 if(!navTarget||!navMap)return;
 const target=[navTarget.lat,navTarget.lon];
 if(GPS)navMap.fitBounds([[GPS.latitude,GPS.longitude],target],{padding:[36,36],maxZoom:18});
 else navMap.setView(target,18);
}
function dgFitWaypoints(showMap=false){
 if(window.DG_WAYPOINT_MAP_VIEWPORT)return window.DG_WAYPOINT_MAP_VIEWPORT.fit({showMap,map:navMap,waypoints:WP,gps:GPS,panel:showMap?$("wpMapPanel"):null});
 if(showMap){const p=$("wpMapPanel");if(p)p.open=true;if(navMap?.invalidateSize)navMap.invalidateSize();}
 if(!navMap||!WP.length)return;
 const points=WP.map(w=>[w.lat,w.lon]);
 if(GPS)points.push([GPS.latitude,GPS.longitude]);
 navMap.fitBounds(points,{padding:[36,36],maxZoom:18});
}
function dgWaypointGuidance(){
 return window.DG_RENDER_WAYPOINT_NAVIGATION_HEADER.renderGuidance({
  target:navTarget,gps:GPS,distance:hav,translate:dgCf,
  resolve:input=>window.DG_WAYPOINT_GUIDANCE.resolve(input),getElement:$
 });
}
// Arrival opens the form; only saved measurement data completes a point.
async function arriveWp(){
 const app=window.DG_ARRIVE_AT_WAYPOINT,selection=window.DG_SELECT_WAYPOINT_ARRIVAL_TARGET,confirmation=window.DG_CONFIRM_WAYPOINT_ARRIVAL_DISTANCE,completion=window.DG_COMPLETE_WAYPOINT_ARRIVAL;
 await app.arrive({target:navTarget,waypoints:WP,gps:GPS,distance:hav,selectTarget:selection.select,confirmDistance:input=>confirmation.confirm({...input,confirm,format:dgTfs}),complete:waypoint=>completion.complete({waypoint,setPoint:value=>{$("mPoint").value=value;},setTarget:value=>{navTarget=value;},draw:drawNav,refresh:loadWaypoints,hasProjectField:()=>$("mProject"),setProject:value=>{$("mProject").value=value;},notify:toast,format:dgTfs,go}),notify:toast});
}
window.arriveWp=arriveWp;

function drawNav(){
 const model=window.DG_BUILD_WAYPOINT_NAVIGATION_HEADER.build({gps:GPS,target:navTarget});
 window.DG_RENDER_WAYPOINT_NAVIGATION_HEADER.render({model,getElement:$});
 renderWaypointList();
 dgWaypointGuidance();
 if(!navMap)return;
 window.DG_WAYPOINT_MAP_MARKERS.draw({map:navMap,waypoints:WP,leaflet:L,translate:dgCf,onSelect:id=>selectWaypoint(id)});
 if(GPS)navTarget=window.DG_WAYPOINT_GPS_OVERLAY.draw({map:navMap,waypoints:WP,target:navTarget,gps:GPS,leaflet:L,distance:hav,bearing:brg,getElement:$,translate:dgCf,setTarget:point=>{navTarget=point;}});
 renderWaypointList();
 dgWaypointGuidance();
}
/* =========================================================
 * MODÜL 2: HARİTA KATMANI SEÇİMİ
 * ========================================================= */

function switchBaseLayer(type){
 const app=window.DG_SWITCH_BASE_MAP_LAYER,configuration=window.DG_RESOLVE_BASE_MAP_LAYER,selection=window.DG_SYNC_BASE_MAP_LAYER_SELECTION,layers=window.DG_MANAGE_BASE_MAP_LAYERS,create=window.DG_CREATE_BASE_MAP_LAYER;
 return app.switch({map,type,resolve:value=>configuration.resolve(value,DG_ATTR),syncSelection:value=>selection.sync({type:value,getElement:$,setSurfaceBase:base=>{if(window.DG_LC_SENS?.state)window.DG_LC_SENS.state.base=base;}}),hasCurrent:(target,value)=>layers.hasCurrent(target,value),removeTileLayers:target=>layers.removeTileLayers(target),createLayer:(target,value)=>create.create({leaflet:L,map:target,configuration:value}),notify:toast});
}

/* ═══════════ 0036 (T5) · PARK ORTAK CANLI KONUM ═══════════
 * İstek: "ortak proje yapılırken ortaklar haritada birbirlerinin konumunu
 * görsün, her ortak farklı renkte, üstüne gelince kimlik."
 * Tasarım: Supabase Realtime PRESENCE — park başına kanal (dg-park-<id>).
 * GEÇİCİDİR: konum VERİTABANINA YAZILMAZ, kanal kapanınca silinir; yalnız
 * aynı parkın kanalındaki kullanıcılar görür. Kırmızı çizgiler (şema, RLS,
 * migration) hiç devreye girmez. Her adım typeof/try korumalı: Realtime
 * kapalıysa özellik sessizce devre dışı kalır, ölçüm akışı etkilenmez. */
let DG_PARK_CH=null,DG_PARK_CH_ID=0,DG_PARK_CH_PROJECT_ID=0,DG_PARK_JOIN_SERIAL=0,DG_PARK_JOIN_PROJECT_ID=0,DG_PARK_JOIN_PENDING=null,DG_LIVE_ON=true,DG_MATES_LAYER=null,DG_LAST_PING=0,DG_PARK_CH_RETRY=0,DG_PARK_CH_WATCH=null,DG_PARK_CH_LIVE=false;
function dgParkShareFail(){
 DG_PARK_JOIN_SERIAL++;
 DG_PARK_JOIN_PENDING=null;
 if(DG_PARK_CH_WATCH){clearTimeout(DG_PARK_CH_WATCH);DG_PARK_CH_WATCH=null;}
 const failedChannel=DG_PARK_CH;
 return window.DG_FAIL_PARK_LIVE_SHARE.fail({setLive:value=>{DG_PARK_CH_LIVE=value;},retries:()=>DG_PARK_CH_RETRY,setRetries:value=>{DG_PARK_CH_RETRY=value;},note:$('dgMatesNote'),translate:_tmf,setTimer:setTimeout,removeChannel:()=>window.DG_PARK_PRESENCE_CHANNEL_ADAPTER.remove({client:sb,channel:failedChannel}),resetChannel:()=>{if(DG_PARK_CH===failedChannel){DG_PARK_CH=null;DG_PARK_CH_ID=0;DG_PARK_CH_PROJECT_ID=0;}DG_MATES_LAYER?.clearLayers();},isEnabled:()=>DG_LIVE_ON,join:dgLiveShareJoinCurrent});
}
const DG_MATE_COLORS=["#c2452d","#2b6cb0","#7c3aed","#0f766e","#be185d","#4d7c0f","#b45309","#0e7490"];
function dgMateColor(id){return window.DG_PARK_LIVE_MEMBER_COLOR.color(id,DG_MATE_COLORS);}
function dgLiveShareProjectId(){
 const selected=typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW==="nav"?$("nProject"):$("mProject");
 return Number(selected?.value)||0;
}
function dgLiveShareToggle(on){
 DG_LIVE_ON=!!on;
 if(!DG_LIVE_ON){DG_PARK_JOIN_SERIAL++;DG_PARK_JOIN_PENDING=null;DG_PARK_CH_RETRY=0;dgLiveShareLeave();}else{DG_PARK_CH_RETRY=0;dgLiveShareJoinCurrent();}
 if(typeof toast==="function")toast(_tmf(on?"Canlı konum paylaşımı açık (bu parkın ortaklarıyla).":"Canlı konum paylaşımı kapalı."),"info","👥");
}
async function dgLiveShareJoinCurrent(){
 const join=window.DG_JOIN_LIVE_SHARE_PARK,resolve=window.DG_RESOLVE_LIVE_SHARE_JOIN,store=window.DG_FETCH_LIVE_SHARE_PROJECT_PARK,connection=window.DG_PARK_LIVE_SHARE_CONNECTION_UI,status=window.DG_HANDLE_LIVE_SHARE_CHANNEL_STATUS,presence=window.DG_PARK_PRESENCE_CHANNEL_ADAPTER;
 const projectId=dgLiveShareProjectId();
 // Repeated openings of the same project must not invalidate its channel
 // callbacks, and concurrent park lookups must not create duplicate channels.
 if(DG_PARK_JOIN_PROJECT_ID!==projectId){DG_PARK_JOIN_PROJECT_ID=projectId;DG_PARK_JOIN_SERIAL++;DG_PARK_CH_RETRY=0;}
 const serial=DG_PARK_JOIN_SERIAL;
 if(DG_PARK_JOIN_PENDING?.projectId===projectId&&DG_PARK_JOIN_PENDING.serial===serial)return DG_PARK_JOIN_PENDING.promise;
 const isCurrent=()=>serial===DG_PARK_JOIN_SERIAL&&DG_LIVE_ON&&dgLiveShareProjectId()===projectId;
 try{
 const task=join.join({
  enabled:DG_LIVE_ON,user:typeof USER!=="undefined"?USER:null,client:typeof sb!=="undefined"?sb:null,
  projectId,currentParkId:DG_PARK_CH_ID,channel:DG_PARK_CH_PROJECT_ID===projectId?DG_PARK_CH:null,isCurrent,
  resolve:input=>resolve.resolve(input),readParkId:id=>store.fetch({client:sb,projectId:id}),leave:dgLiveShareLeave,
  setParkId:value=>{DG_PARK_CH_ID=value;DG_PARK_CH_PROJECT_ID=value?projectId:0;},
  showConnecting:()=>connection.connecting({element:$("dgMatesNote"),translate:_tmf}),
  subscribe:({parkId,userId,onSync,onStatus})=>{
   let joinedChannel=null;
   return presence.join({
    client:sb,parkId,userId,isCurrent,
    setChannel:value=>{joinedChannel=value;DG_PARK_CH=value;},
    onSync:()=>{if(isCurrent()&&joinedChannel&&DG_PARK_CH===joinedChannel)onSync();},
    onStatus:st=>{if(isCurrent()&&(!joinedChannel||DG_PARK_CH===joinedChannel))onStatus(st);},
    getWatch:()=>DG_PARK_CH_WATCH,setWatch:value=>{DG_PARK_CH_WATCH=value;},clearTimer:clearTimeout,
    setTimer,onWatchdog:()=>{if(isCurrent()&&joinedChannel&&DG_PARK_CH===joinedChannel)dgParkShareFail();}
   });
  },
  onSync:()=>{if(isCurrent())dgLiveMatesDraw();},
  onStatus:st=>{if(isCurrent())status.handle(st,{getWatch:()=>DG_PARK_CH_WATCH,setWatch:value=>{DG_PARK_CH_WATCH=value;},clearTimer:clearTimeout,setLive:value=>{DG_PARK_CH_LIVE=value;},setLastPing:value=>{DG_LAST_PING=value;},onConnected:()=>{DG_PARK_CH_RETRY=0;},ping:dgLiveSharePing,draw:dgLiveMatesDraw,fail:dgParkShareFail});}
 });
 DG_PARK_JOIN_PENDING={projectId,serial,promise:task};
 const result=await task;
 if(isCurrent()&&result?.status==="reused"){DG_PARK_CH_PROJECT_ID=projectId;dgLiveMatesDraw();}
 return result;
 }catch(error){if(isCurrent())dgParkShareFail();return;}
 finally{if(DG_PARK_JOIN_PENDING?.projectId===projectId&&DG_PARK_JOIN_PENDING.serial===serial)DG_PARK_JOIN_PENDING=null;}
}
function dgLiveShareLeave(){
 DG_PARK_CH_PROJECT_ID=0;
 DG_PARK_CH_LIVE=false;
 if(DG_PARK_CH_WATCH){clearTimeout(DG_PARK_CH_WATCH);DG_PARK_CH_WATCH=null;}
 return window.DG_LEAVE_PARK_PRESENCE_CHANNEL.leave({channel:DG_PARK_CH,client:typeof sb!=="undefined"?sb:null,layer:DG_MATES_LAYER,map:typeof navMap!=="undefined"?navMap:null,setChannel:value=>{DG_PARK_CH=value;},setParkId:value=>{DG_PARK_CH_ID=value;},setLayer:value=>{DG_MATES_LAYER=value;},note:$("dgMatesNote")});
}
function dgLiveSharePing(){
 return window.DG_TRACK_PARK_LIVE_POSITION.ping({channel:DG_PARK_CH,live:DG_PARK_CH_LIVE,enabled:DG_LIVE_ON,gps:typeof GPS!=="undefined"?GPS:null,userId:typeof USER!=="undefined"?USER?.id:null,name:typeof PROFILE!=="undefined"&&PROFILE?PROFILE.full_name:null,lastPing:DG_LAST_PING,now:Date.now(),setLastPing:value=>{DG_LAST_PING=value;}});
}
function dgLiveMatesDraw(){
 if(typeof navMap==="undefined"||!navMap||typeof L==="undefined")return;
 // Never keep the previous project's teammate positions on a newly selected
 // waypoint map, even while the next private channel is being authorized.
 if(!DG_PARK_CH||!DG_LIVE_ON||DG_PARK_CH_PROJECT_ID!==Number($("nProject")?.value||0)){
  DG_MATES_LAYER?.clearLayers();
  window.DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT.render({element:$("dgMatesNote"),count:0,translate:_tmff});
  return;
 }
 const presence=window.DG_PARK_PRESENCE_CHANNEL_ADAPTER.presence({channel:DG_PARK_CH});
 const layer=window.DG_PREPARE_PARK_LIVE_COLLABORATOR_LAYER.prepare({layer:DG_MATES_LAYER,map:navMap,leaflet:L,setLayer:value=>{DG_MATES_LAYER=value;}});
 const members=window.DG_SELECT_PARK_LIVE_COLLABORATORS.select({presence,currentUserId:USER.id});
 const now=Date.now();
 for(const member of members){
  const view=window.DG_BUILD_PARK_LIVE_COLLABORATOR_VIEW.build({member,color:id=>dgMateColor(id),now,format:dgCf});
  window.DG_RENDER_PARK_LIVE_COLLABORATOR_MARKER.render({layer,leaflet:L,member,view,escape:esc,translate:_tmf});
 }
 window.DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT.render({element:$("dgMatesNote"),count:members.length,translate:_tmff});
}
