"use strict";
/* DendroGeo · services/visit-stats.js — ZİYARETÇİ SAYACI (Faz 6)
 * admin.js'ten birebir taşındı. trackVisit RLS-safe raw fetch + 
 * Prefer: return=minimal kullanır (Faz F kilidi: test/critical-fixes). */

/* ============ ZİYARETÇİ SAYACI ============ */
const DG_VISITOR_TRACK_VISIT_ADAPTER=window.DG_VISITOR_TRACK_VISIT_ADAPTER.create();
async function trackVisit(){
 try{
  if(sessionStorage.getItem("dg_visited"))return;
  sessionStorage.setItem("dg_visited","1");
  /* Adapter sends method:"POST" to /rest/v1/site_visits with Prefer: return=minimal (RLS-safe). */
  await DG_VISITOR_TRACK_VISIT_ADAPTER.record(fetch,SB_URL,SB_KEY);
 }catch(e){}
}

const DG_VISITOR_ADMIN_VISIT_COUNTS_STORE=window.DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.create();
const DG_ADMIN_VISIT_STATISTICS=window.DG_LOAD_ADMIN_VISIT_STATISTICS.create({
  loadTotal:()=>DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.total(sb),
  loadSince:date=>DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.since(sb,date),
  resolveWindows:()=>window.DG_RESOLVE_ADMIN_VISIT_WINDOWS.resolve(Date.now()),
  setTotal:value=>window.DG_VISITOR_ADMIN_COUNTS_UI.total($("aVisitTotal"),value),
  setToday:value=>window.DG_VISITOR_ADMIN_COUNTS_UI.today($("aVisitToday"),value),
  setSevenDays:value=>window.DG_VISITOR_ADMIN_COUNTS_UI.sevenDays($("aVisit7"),value),
  fail:()=>window.DG_VISITOR_ADMIN_COUNTS_UI.failed($("aVisitTotal"))
 });
async function loadVisitStats(){
 return DG_ADMIN_VISIT_STATISTICS();
}

/* ═══════════ 0038 · CANLI VARLIK + ZİYARETÇİ SEKMESİ ═══════════
 * İKİ KÖK DÜZELTME (kullanıcı bildirimi: "connecting'de takılı, ortakları
 * göremiyorum"):
 *  1) SUBSCRIBE ÖNCE, AUTH ARKA PLANDA: eskiden presence kanalından ÖNCE
 *     `getSession()` çağrılıyordu; oturum kilit/önbellek
 *     nedeniyle takılırsa kanal HİÇ kurulmuyor, durum "connecting"de
 *     kalıyordu. Presence anon apikey ile çalışır (canlı WS probuyla
 *     doğrulandı: phx_join → ok). JWT sonra, bloklamadan yükseltilir.
 *  2) WATCHDOG: 8 sn içinde SUBSCRIBED gelmezse kanal düşürülüp 2 kez
 *     yeniden denenir; olmazsa kart ⚠ durumunu GÖSTERİR (sessiz ölüm yok).
 * Konum alanı (la/lo) yalnız kullanıcı "canlı konum paylaşımı"nı AÇTIYSA
 * ve GPS varsa payload'a girer; GEÇİCİDİR — veritabanına yazılmaz. */
const DG_VIEW_LABELS=window.DG_VISITOR_VIEW_LABELS||{dash:"Panel",measure:"Yeni Ölçüm",nav:"Waypoint",map:"Canlı Harita",projects:"Projeler",records:"Kayıtlarım",export:"Dışa Aktar",world:"Dünya Verisi",admin:"Ölçüm Yönetimi",users:"Kullanıcılar",visitors:"Ziyaretçi & Canlı"};
let DG_PRES=null,DG_PRES_OK=false,DG_PRES_STATE="idle",DG_PRES_RETRY=0,DG_PRES_LAST=0,DG_PRES_WATCH=null,DG_PRES_HEARTBEAT=null,DG_PRES_TIMER=null,DG_PRES_USER=null,DG_PRES_GENERATION=0;
const DG_VISITOR_PRESENCE_CHANNEL_ADAPTER=window.DG_VISITOR_PRESENCE_CHANNEL_ADAPTER.create(()=>sb);
const DG_VISITOR_REMOVE_PRESENCE_CHANNEL=window.DG_VISITOR_REMOVE_PRESENCE_CHANNEL.create();
const DG_UPGRADE_VISITOR_PRESENCE_AUTH=window.DG_UPGRADE_VISITOR_PRESENCE_AUTH.create();
const DG_AUTH_SESSION_PORTS=window.DG_AUTH_SESSION_STORE.create(()=>sb);
const DG_VISITOR_TRACK_PRESENCE=window.DG_VISITOR_TRACK_PRESENCE.create();
const DG_VISITOR_PRESENCE_LIFECYCLE_STATE={
 get channel(){return DG_PRES;},set channel(value){DG_PRES=value;},
 get ready(){return DG_PRES_OK;},set ready(value){DG_PRES_OK=value;},
 get status(){return DG_PRES_STATE;},set status(value){DG_PRES_STATE=value;},
 get retryCount(){return DG_PRES_RETRY;},set retryCount(value){DG_PRES_RETRY=value;},
 get lastPing(){return DG_PRES_LAST;},set lastPing(value){DG_PRES_LAST=value;},
 get watchTimer(){return DG_PRES_WATCH;},set watchTimer(value){DG_PRES_WATCH=value;},
 get heartbeatTimer(){return DG_PRES_HEARTBEAT;},set heartbeatTimer(value){DG_PRES_HEARTBEAT=value;},
 get retryTimer(){return DG_PRES_TIMER;},set retryTimer(value){DG_PRES_TIMER=value;},
 get user(){return DG_PRES_USER;},set user(value){DG_PRES_USER=value;},
 get generation(){return DG_PRES_GENERATION;},set generation(value){DG_PRES_GENERATION=value;}
};
/* Keep native Window timer methods on their required receiver when application
 * use-cases call them through an injected port object. */
const DG_VISITOR_PRESENCE_TIMERS={
 setTimeout:(...args)=>window.setTimeout(...args),
 clearTimeout:(...args)=>window.clearTimeout(...args),
 setInterval:(...args)=>window.setInterval(...args),
 clearInterval:(...args)=>window.clearInterval(...args)
};
function dgPresenceState(){return DG_PRES_STATE;}
function dgPresenceReady(){return !!DG_PRES_OK;}
function dgPresenceEmit(){try{if(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW!=="visitors")return;if(typeof renderVisitorsLive==="function")renderVisitorsLive();}catch(e){}}
function dgPresenceStop(){
 return window.DG_STOP_VISITOR_PRESENCE_SESSION.stop(DG_VISITOR_PRESENCE_LIFECYCLE_STATE,DG_VISITOR_PRESENCE_TIMERS,old=>{
  if(typeof sb!=="undefined")DG_VISITOR_REMOVE_PRESENCE_CHANNEL.remove(sb,old);
 });
}
function dgPresenceFail(why){
 return window.DG_FAIL_VISITOR_PRESENCE_SESSION.fail(DG_VISITOR_PRESENCE_LIFECYCLE_STATE,why,{
  timers:DG_VISITOR_PRESENCE_TIMERS,emit:dgPresenceEmit,
  retryDelay:attempt=>window.DG_VISITOR_PRESENCE_RETRY_DELAY.resolve(attempt),
  stop:dgPresenceStop,start:dgPresenceStart
 });
}
function dgPresenceStart(){
 return window.DG_START_VISITOR_PRESENCE_SESSION.start({
  state:DG_VISITOR_PRESENCE_LIFECYCLE_STATE,
  user:typeof USER!=="undefined"?USER:null,sessionId:DG_SID,
  channelAdapter:DG_VISITOR_PRESENCE_CHANNEL_ADAPTER,authUpgrade:DG_UPGRADE_VISITOR_PRESENCE_AUTH,authPorts:DG_AUTH_SESSION_PORTS,
  timers:DG_VISITOR_PRESENCE_TIMERS,emit:dgPresenceEmit,ping:dgPresencePing,
  stop:dgPresenceStop,fail:dgPresenceFail,
  getView:()=>typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash"
 });
}
function dgPresenceResume(){
 return window.DG_RESUME_VISITOR_PRESENCE_SESSION.resume({
  user:typeof USER!=="undefined"?USER:null,ready:DG_PRES_OK,
  stop:dgPresenceStop,start:dgPresenceStart,ping:dgPresencePing
 });
}
if(typeof window.addEventListener==="function")window.addEventListener("online",dgPresenceResume);
window.DG_VISITOR_CONNECTION_STATUS_UI.bindVisibilityResume(document,dgPresenceResume);
/* 0045 · GELİŞMİŞ CANLI İZLEME (kullanıcı: "gerçek bir izleme olsun, daha
 * detaylı olsun"). VERİTABANINA YAZMAZ: tüm alanlar presence payload'ında
 * taşınır (geçici) — kanal düşince/sekmeler kapanınca buharlaşır. Yeni tablo/
 * migration/RLS YOK (kırmızı çizgi); gizlilik metnindeki mevcut beyanla birebir
 * uyumlu (konum yalnız GPS açıksa ve geçici). Yalnız kurucu sekmesi okur. */
const DG_SID=(()=>{try{return window.DG_VISITOR_SESSION_ID_STORE.load(sessionStorage);}catch(e){return "x";}})();
const DG_SESSION_START=Date.now();
const DG_DEV_TAG=(()=>{try{return window.DG_VISITOR_DEVICE_LABEL.build(navigator.userAgent);}catch(e){return "?";}})();
const DG_ACT_LABELS=window.DG_VISITOR_ACTION_LABELS||{save:"ölçüm kaydetti",edit:"kayıt güncelledi",park:"park algıladı",export:"dışa aktardı",publish:"rapor yayını istedi"};
const DG_VISITOR_ACTIVITY=window.DG_VISITOR_ACTIVITY_APPLICATION.create();
const DG_VISITOR_STORED_ACTIVITY=window.DG_VISITOR_STORED_ACTIVITY_APPLICATION.create();
const DG_VISITOR_STORED_ACTIVITY_STORE=window.DG_VISITOR_STORED_ACTIVITY_STORE.create();
const DG_VISITOR_LIVE_VISIT_COUNTS_STORE=window.DG_VISITOR_LIVE_VISIT_COUNTS_STORE.create();
const DG_VISITOR_SESSION_EVENTS=window.DG_VISITOR_SESSION_EVENTS_APPLICATION.create();
/* Sekme değişince çağrılır (shell go()): gezinme zincirine yazar. */
function dgPresenceView(v){
 try{window.DG_SITE_TRAFFIC?.workspace(v);}catch(error){}
 if(window.DG_RECORD_VISITOR_PRESENCE_VIEW)return window.DG_RECORD_VISITOR_PRESENCE_VIEW.record(v,DG_VISITOR_SESSION_EVENTS,dgPresencePing);
 try{
  if(!DG_VISITOR_SESSION_EVENTS.recordView(v))return;
  dgPresencePing(v,true);
 }catch(e){}
}
/* Önemli kullanıcı aksiyonunda çağrılır (kaydet/park/export/yayın). */
function dgPresenceAct(k,d){
 if(window.DG_RECORD_VISITOR_PRESENCE_ACTION)return window.DG_RECORD_VISITOR_PRESENCE_ACTION.record(k,d,DG_VISITOR_SESSION_EVENTS,dgPresencePing);
 try{DG_VISITOR_SESSION_EVENTS.recordAction(k,d);dgPresencePing(null,true);}catch(e){}
}
function dgPresencePing(view,force){
 try{
  if(!DG_PRES||!DG_PRES_OK||typeof DG_PRES.track!=="function")return;
  const now=Date.now();
  if(window.DG_VISITOR_PRESENCE_PING_WINDOW){
   if(!window.DG_VISITOR_PRESENCE_PING_WINDOW.shouldSend({force,now,lastSent:DG_PRES_LAST}))return;
  }else if(!force&&now-DG_PRES_LAST<10000)return;
  DG_PRES_LAST=now;
  const p=window.DG_VISITOR_PRESENCE_PAYLOAD?window.DG_VISITOR_PRESENCE_PAYLOAD.build({
   user:USER,profile:typeof PROFILE!=="undefined"?PROFILE:null,
   view:view||(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash"),now,
   gps:typeof GPS!=="undefined"?GPS:null,sid:DG_SID,sessionStart:DG_SESSION_START,deviceTag:DG_DEV_TAG,
   events:DG_VISITOR_SESSION_EVENTS,hidden:document.hidden
  }):{id:String(USER.id),
   n:(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.full_name||PROFILE.email))||"?",
   r:(typeof PROFILE!=="undefined"&&PROFILE&&PROFILE.role)||"user",
   v:view||(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash"),t:now};
  /* 0040 (kullanıcı kararı): konum, GPS AÇIKSA kurucu görünümü için OTOMATİK
   * paylaşılır (ayrı anahtar yok) — GEÇİCİDİR, veritabanına yazılmaz; kayıt
   * onayında yönetici zaten saklı konumları görebilir. Park ORTAK kanalı
   * ayrıca kullanıcının 👥 anahtarına bağlıdır (map.js canlı paylaşım bayrağı). */
  if(!window.DG_VISITOR_PRESENCE_PAYLOAD&&typeof GPS!=="undefined"&&GPS&&GPS.latitude!=null){p.la=GPS.latitude;p.lo=GPS.longitude;
   DG_VISITOR_SESSION_EVENTS.recordLocation(p.la,p.lo,now);
  }
  /* 0045: oturum/cihaz/gezinti/aksiyon/iz — hep geçici presence alanı. */
  if(!window.DG_VISITOR_PRESENCE_PAYLOAD){
   p.sid=DG_SID;p.st=DG_SESSION_START;p.dev=DG_DEV_TAG;
   const {views:DG_VIEW_HIST,lastAction:DG_LAST_ACT,locations:DG_LOC_HIST}=DG_VISITOR_SESSION_EVENTS.snapshot();
   if(DG_VIEW_HIST.length)p.vh=DG_VIEW_HIST;
   if(DG_LAST_ACT)p.act=DG_LAST_ACT;
   if(p.la!=null&&DG_LOC_HIST.length>1)p.lh=DG_LOC_HIST;
   p.hidden=!!document.hidden;
  }
  const channel=DG_PRES,generation=DG_PRES_GENERATION;
  if(DG_VISITOR_TRACK_PRESENCE)DG_VISITOR_TRACK_PRESENCE.send(channel,p,generation,value=>value===DG_PRES_GENERATION,dgPresenceFail);
  else Promise.resolve(channel.track(p)).then(status=>{if(generation===DG_PRES_GENERATION&&status!=="ok")dgPresenceFail("TRACK");}).catch(()=>{if(generation===DG_PRES_GENERATION)dgPresenceFail("TRACK");});
 }catch(e){}
}
function dgPresenceList(){try{return (DG_PRES&&typeof DG_PRES.presenceState==="function")?DG_PRES.presenceState():{};}catch(e){return{};}}

/* ─────────── 👁 ZİYARETÇİ & CANLI (yalnız kurucu) ─────────── */
let DG_VIS_MAP=null,DG_VIS_LAYER=null,DG_VIS_PAUSED=false,DG_VIS_FIT=false,DG_VIS_REFRESHING=false;
/* 0045: "Son Etkinlik" açılır-kapanır (kullanıcı isteği). Durum cihazda
 * hatırlanır (localStorage) — sekme her açılışta kullanıcının bıraktığı gibi. */
function dgVisActToggle(){
 const w=$("visActivityWrap"),b=$("visActToggle");if(!w)return;
 const T=(x)=>(typeof dgCf==="function"?dgCf(x):x);
 const open=DG_VISITOR_ACTIVITY_DISCLOSURE_UI.isOpen(w);
 return window.DG_TOGGLE_VISITOR_ACTIVITY_DISCLOSURE.toggle(open,{
  render:value=>DG_VISITOR_ACTIVITY_DISCLOSURE_UI.render(w,b,value,{translate:T}),
  persist:value=>{try{localStorage.setItem("dg_vis_act_open",value?"1":"0");}catch(e){}}
 });
}
function dgVisActRestore(){
 const w=$("visActivityWrap"),b=$("visActToggle");if(!w)return;
 const T=(x)=>(typeof dgCf==="function"?dgCf(x):x);
 return window.DG_RESTORE_VISITOR_ACTIVITY_DISCLOSURE.restore({
  read:()=>localStorage.getItem("dg_vis_act_open"),
  render:value=>DG_VISITOR_ACTIVITY_DISCLOSURE_UI.render(w,b,value,{translate:T})
 });
}
async function loadVisitors(){
 if(typeof PROFILE==="undefined"||!PROFILE||PROFILE.role!=="owner")return;
 dgVisActRestore();
 renderVisitorsLive();
 dgVisCounts();
 dgVisActivity();
 dgVisTickStart();
}
async function dgVisCounts(){
 void window.DG_VISITOR_ANALYTICS_PANEL?.load();
 return window.DG_LOAD_OWNER_VISITOR_COUNTS.execute(dgVisAllowed,{load:()=>DG_VISITOR_LIVE_VISIT_COUNTS_STORE.load(sb),update:(id,value)=>DG_VISITOR_ADMIN_COUNTS_UI.update(document,id,value)});
}
function dgVisAllowed(){return typeof PROFILE!=="undefined"&&PROFILE?.role==="owner";}
const DG_VISITOR_ROSTER=window.DG_VISITOR_ROSTER_APPLICATION.create();
const DG_VISITOR_LIVE_MAP=window.DG_VISITOR_LIVE_MAP_UI?.create?.()||null;
function dgVisHasLocation(p){return DG_VISITOR_ROSTER.hasLocation(p);}
function dgVisRows(){
 let st={};try{st=dgPresenceList();}catch(e){}
 return DG_VISITOR_ROSTER.rows(st,Date.now(),dgPresenceReady());
}
function dgVisFilter(rows){return DG_VISITOR_ROSTER.filter(rows,{query:$("visSearch")?.value||"",view:$("visViewFilter")?.value||"",located:!!$("visLocated")?.checked});}
function dgVisResetFilters(){if(window.DG_UPDATE_LIVE_VISITOR_FILTERS)return window.DG_UPDATE_LIVE_VISITOR_FILTERS.reset({text:[$("visSearch"),$("visViewFilter")],located:$("visLocated")},renderVisitorsLive);for(const id of ["visSearch","visViewFilter"]){const el=$(id);if(el)el.value="";}const located=$("visLocated");if(located)located.checked=false;renderVisitorsLive();}
function dgVisQuick(view,located){
 if(window.DG_UPDATE_LIVE_VISITOR_FILTERS)return window.DG_UPDATE_LIVE_VISITOR_FILTERS.quick({search:$("visSearch"),view:$("visViewFilter"),located:$("visLocated")},view,located,renderVisitorsLive);
 const search=$("visSearch"),filter=$("visViewFilter"),loc=$("visLocated");
 if(search)search.value="";
 if(filter)filter.value=view||"";
 if(loc)loc.checked=!!located;
 renderVisitorsLive();
}
function dgVisPause(on){DG_VIS_PAUSED=!!on;if(window.DG_SET_LIVE_VISITOR_PAUSE)return window.DG_SET_LIVE_VISITOR_PAUSE.set(DG_VIS_PAUSED,{render:renderVisitorsLive,showPaused:()=>DG_VISITOR_CONNECTION_STATUS_UI.paused($("visStatus"))});if(!on)renderVisitorsLive();else DG_VISITOR_CONNECTION_STATUS_UI.paused($("visStatus"));}
function dgVisFit(){if(window.DG_FIT_LIVE_VISITOR_MAP)return window.DG_FIT_LIVE_VISITOR_MAP.fit(value=>{DG_VIS_FIT=value;},dgVisFilter,dgVisRows(),dgVisMapDraw);DG_VIS_FIT=false;dgVisMapDraw(dgVisFilter(dgVisRows()));}
function renderVisitorsLive(){
 return window.DG_RENDER_OWNER_LIVE_VISITOR_VIEW.render({
  allowed:dgVisAllowed(),paused:DG_VIS_PAUSED,hidden:document.hidden,
  view:typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"visitors",
  readRows:dgVisRows,filterRows:dgVisFilter,hasLocation:dgVisHasLocation,
  summarize:(rows,hasLocation)=>window.DG_SUMMARIZE_LIVE_VISITOR_COUNTS.summarize(rows,hasLocation),
  updateCounts:counts=>{DG_VISITOR_ADMIN_COUNTS_UI.update(document,"vzOnline",counts.online);DG_VISITOR_ADMIN_COUNTS_UI.update(document,"vzLocated",counts.located);},
  renderPanel:(rows,allCount)=>window.DG_VISITOR_LIVE_PANEL_UI.render({
   statusElement:$("visStatus"),state:dgPresenceState(),rows,allCount,rosterElement:$("visLive"),
   viewLabels:DG_VIEW_LABELS,actionLabels:DG_ACT_LABELS,hasLocation:dgVisHasLocation,
   deviceLabel:row=>row.p.dev,translate:value=>typeof dgCf==="function"?dgCf(value):value,escape:esc,focus:(lat,lon)=>dgVisFocus(lat,lon),
   connectionStatus:DG_VISITOR_CONNECTION_STATUS_UI,roster:DG_VISITOR_ROSTER_UI
  }),
  renderFeed:rows=>{if($("visLive"))dgVisFeed(rows);},
  drawMap:dgVisMapDraw
 });
}
/* 0045: 📡 CANLI AKSİYON AKIŞI — presence'teki oturum/gezinti/aksiyon
 * olaylarından anlık akış (geçici; DB sorgusu YOK). */
function dgVisFeed(rows){
 const box=$("visFeed");if(!box)return;
 const T=(x)=>(typeof dgCf==="function"?dgCf(x):x);
 const loc=(typeof DG_LANG!=="undefined"&&DG_LANG==="en")?"en-GB":"tr-TR";
 const top=DG_VISITOR_ACTIVITY.build(rows,{viewLabels:DG_VIEW_LABELS,actionLabels:DG_ACT_LABELS,translate:T,maxItems:18});
 DG_VISITOR_ACTIVITY_FEED_UI.render(box,top,{locale:loc,translate:T,escape:esc});
}
function dgVisMapInit(){
 if(DG_VISITOR_LIVE_MAP){const result=DG_VISITOR_LIVE_MAP.initialize({element:$("visMap"),map:DG_VIS_MAP,layer:DG_VIS_LAYER,leaflet:typeof L!=="undefined"?L:null,attribution:typeof DG_ATTR!=="undefined"?DG_ATTR.osm:""});DG_VIS_MAP=result.map;DG_VIS_LAYER=result.layer;return;}
 const el=$("visMap");
 if(!el||DG_VIS_MAP||typeof L==="undefined")return;
 try{
  DG_VIS_MAP=L.map("visMap").setView([39,35],6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(DG_VIS_MAP);
  DG_VIS_LAYER=L.layerGroup().addTo(DG_VIS_MAP);
 }catch(e){DG_VIS_MAP=null;}
}
function dgVisMapDraw(rows){
 if(DG_VISITOR_LIVE_MAP){dgVisMapInit();DG_VIS_FIT=DG_VISITOR_LIVE_MAP.draw({
  map:DG_VIS_MAP,layer:DG_VIS_LAYER,leaflet:typeof L!=="undefined"?L:null,rows,
  hasLocation:dgVisHasLocation,viewLabels:DG_VIEW_LABELS,
  translate:value=>typeof dgCf==="function"?dgCf(value):value,escape:esc,
  colorFor:id=>typeof dgMateColor==="function"?dgMateColor(id):"#2b6cb0",
  trails:!!$("visTrails")?.checked,follow:!!$("visFollow")?.checked,fit:DG_VIS_FIT,
  buildTrail:window.DG_BUILD_LIVE_LOCATION_TRAIL.build
 });return;}
 dgVisMapInit();
 if(!DG_VIS_MAP||!DG_VIS_LAYER)return;
 try{DG_VIS_MAP.invalidateSize();}catch(e){}
 DG_VIS_LAYER.clearLayers();
 const T=(s)=>(typeof dgCf==="function"?dgCf(s):s);
 const pts=[];
 for(const r of (rows||[])){
  if(!dgVisHasLocation(r.p))continue;
  pts.push(r);
  const col=(typeof dgMateColor==="function")?dgMateColor(r.p.id):"#2b6cb0";
  const presentation=DG_VISITOR_MAP_MARKER_UI.build(r,{color:col,viewLabels:DG_VIEW_LABELS,translate:T,escape:esc});
  const ic=L.divIcon(presentation.icon);
  /* 0045: geçici konum İZİ (presence lh) — kesikli polizgi, DB'ye yazılmaz. */
  if($("visTrails")?.checked&&Array.isArray(r.p.lh)&&r.p.lh.length>1){
   try{
    L.polyline(r.p.lh.filter(q=>Array.isArray(q)&&dgVisHasLocation({la:q[0],lo:q[1]})).slice(-30).map(q=>[q[0],q[1]]),{color:col,weight:2,opacity:.55,dashArray:"3 6",interactive:false}).addTo(DG_VIS_LAYER);
    L.circleMarker([r.p.lh[0][0],r.p.lh[0][1]],{radius:3,color:col,fillColor:"#fff",fillOpacity:.9,weight:2,interactive:false}).addTo(DG_VIS_LAYER);
   }catch(e){}
  }
  L.marker([r.p.la,r.p.lo],{icon:ic,interactive:true,keyboard:false,zIndexOffset:700}).addTo(DG_VIS_LAYER)
   .bindTooltip(presentation.tooltip,presentation.tooltipOptions);
 }
 try{
  if((!DG_VIS_FIT||$("visFollow")?.checked)&&pts.length===1)DG_VIS_MAP.setView([pts[0].p.la,pts[0].p.lo],13);
  else if((!DG_VIS_FIT||$("visFollow")?.checked)&&pts.length>1)DG_VIS_MAP.fitBounds(L.latLngBounds(pts.map(r=>[r.p.la,r.p.lo])).pad(0.35),{maxZoom:14});
 if(pts.length)DG_VIS_FIT=true;
 }catch(e){}
}
async function dgVisActivity(){
 const translate=(value)=>(typeof dgCf==="function"?dgCf(value):value);
 return window.DG_LOAD_OWNER_VISITOR_ACTIVITY.execute(typeof PROFILE==="undefined"?null:PROFILE,{
  container:()=>$("visActivity"),load:()=>DG_VISITOR_STORED_ACTIVITY_STORE.load(sb),
  build:(data,options)=>DG_VISITOR_STORED_ACTIVITY.build(data,options),
  locale:()=>typeof DG_LANG!=="undefined"&&DG_LANG==="en"?"en-GB":"tr-TR",
  translate,translateValue:value=>typeof dgT==="function"?dgT(value||""):value,escape:esc,
  render:(box,rows,options)=>DG_VISITOR_DATABASE_ACTIVITY_UI.render(box,rows,options)
 });
}

/* 0040: elle yenileme + 10 sn otomatik tik (yalnız sekme açıkken) + odaklanma */
async function dgVisRefresh(){if(window.DG_REFRESH_OWNER_VISITOR_VIEW){return window.DG_REFRESH_OWNER_VISITOR_VIEW.execute(dgVisAllowed,{isRefreshing:()=>DG_VIS_REFRESHING,resume:()=>dgPresenceResume(),setRefreshing:value=>{DG_VIS_REFRESHING=value;},render:()=>renderVisitorsLive(),counts:()=>dgVisCounts(),activity:()=>dgVisActivity()});}if(!dgVisAllowed()||DG_VIS_REFRESHING)return;dgPresenceResume();DG_VIS_REFRESHING=true;try{renderVisitorsLive();await Promise.all([dgVisCounts(),dgVisActivity()]);}finally{DG_VIS_REFRESHING=false;}}
let DG_VIS_TIMER=null;
function dgVisTickStart(){if(window.DG_VISITOR_LIVE_REFRESH_TIMER){return window.DG_VISITOR_LIVE_REFRESH_TIMER.start({getTimer:()=>DG_VIS_TIMER,setTimer:value=>{DG_VIS_TIMER=value;},setInterval:(callback,delay)=>setInterval(callback,delay),clearInterval:id=>clearInterval(id),isVisitorsView:()=>typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW==="visitors",render:()=>renderVisitorsLive()});}dgVisTickStop();DG_VIS_TIMER=setInterval(()=>{try{if(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW==="visitors")renderVisitorsLive();}catch(e){}},10000);}
function dgVisTickStop(){if(window.DG_VISITOR_LIVE_REFRESH_TIMER){return window.DG_VISITOR_LIVE_REFRESH_TIMER.stop({getTimer:()=>DG_VIS_TIMER,setTimer:value=>{DG_VIS_TIMER=value;},clearInterval:id=>clearInterval(id)});}if(DG_VIS_TIMER){clearInterval(DG_VIS_TIMER);DG_VIS_TIMER=null;}}
function dgVisFocus(la,lo){if(window.DG_FOCUS_LIVE_VISITOR_LOCATION){return window.DG_FOCUS_LIVE_VISITOR_LOCATION.focus(la,lo,{allowed:dgVisAllowed,hasLocation:dgVisHasLocation,followControl:()=>$("visFollow"),map:()=>DG_VIS_MAP});}try{if(!dgVisAllowed()||!dgVisHasLocation({la,lo}))return;const follow=$("visFollow");if(follow)follow.checked=false;if(DG_VIS_MAP)DG_VIS_MAP.setView([la,lo],16);}catch(e){}}
