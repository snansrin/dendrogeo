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
async function loadVisitStats(){
 try{
  const total=await DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.total(sb);
  $("aVisitTotal").textContent=total.count??0;
  const today=new Date();today.setHours(0,0,0,0);
  const t=await DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.since(sb,today.toISOString());
  $("aVisitToday").textContent=t.count??0;
  const d7=new Date(Date.now()-7*86400000);
  const w=await DG_VISITOR_ADMIN_VISIT_COUNTS_STORE.since(sb,d7.toISOString());
  $("aVisit7").textContent=w.count??0;
 }catch(e){$("aVisitTotal").textContent="—";}
}

/* ═══════════ 0038 · CANLI VARLIK + ZİYARETÇİ SEKMESİ ═══════════
 * İKİ KÖK DÜZELTME (kullanıcı bildirimi: "connecting'de takılı, ortakları
 * göremiyorum"):
 *  1) SUBSCRIBE ÖNCE, AUTH ARKA PLANDA: eskiden sb.channel'dan ÖNCE
 *     `await sb.auth.getSession()` çağrılıyordu; getSession kilit/önbellek
 *     nedeniyle takılırsa kanal HİÇ kurulmuyor, durum "connecting"de
 *     kalıyordu. Presence anon apikey ile çalışır (canlı WS probuyla
 *     doğrulandı: phx_join → ok). JWT sonra, bloklamadan yükseltilir.
 *  2) WATCHDOG: 8 sn içinde SUBSCRIBED gelmezse kanal düşürülüp 2 kez
 *     yeniden denenir; olmazsa kart ⚠ durumunu GÖSTERİR (sessiz ölüm yok).
 * Konum alanı (la/lo) yalnız kullanıcı "canlı konum paylaşımı"nı AÇTIYSA
 * ve GPS varsa payload'a girer; GEÇİCİDİR — veritabanına yazılmaz. */
const DG_VIEW_LABELS={dash:"Panel",measure:"Yeni Ölçüm",nav:"Waypoint",map:"Canlı Harita",projects:"Projeler",records:"Kayıtlarım",export:"Dışa Aktar",world:"Dünya Verisi",admin:"Ölçüm Yönetimi",users:"Kullanıcılar",visitors:"Ziyaretçi & Canlı"};
let DG_PRES=null,DG_PRES_OK=false,DG_PRES_STATE="idle",DG_PRES_RETRY=0,DG_PRES_LAST=0,DG_PRES_WATCH=null,DG_PRES_HEARTBEAT=null,DG_PRES_TIMER=null,DG_PRES_USER=null,DG_PRES_GENERATION=0;
function dgPresenceState(){return DG_PRES_STATE;}
function dgPresenceReady(){return !!DG_PRES_OK;}
function dgPresenceEmit(){try{if(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW!=="visitors")return;if(typeof renderVisitorsLive==="function")renderVisitorsLive();}catch(e){}}
function dgPresenceStop(){
 ++DG_PRES_GENERATION;clearTimeout(DG_PRES_TIMER);clearTimeout(DG_PRES_WATCH);clearInterval(DG_PRES_HEARTBEAT);
 DG_PRES_TIMER=DG_PRES_WATCH=DG_PRES_HEARTBEAT=null;const old=DG_PRES;DG_PRES=null;DG_PRES_USER=null;DG_PRES_OK=false;DG_PRES_STATE="idle";
 if(old&&typeof sb!=="undefined")Promise.resolve(sb.removeChannel(old)).catch(()=>{});
}
function dgPresenceFail(why){
 if(!DG_PRES||DG_PRES_TIMER)return;
 clearTimeout(DG_PRES_WATCH);clearInterval(DG_PRES_HEARTBEAT);DG_PRES_WATCH=DG_PRES_HEARTBEAT=null;
 DG_PRES_OK=false;DG_PRES_STATE="error";dgPresenceEmit();
 const delay=Math.min(30000,1500*2**Math.min(DG_PRES_RETRY++,4));
 DG_PRES_TIMER=setTimeout(()=>{DG_PRES_TIMER=null;dgPresenceStop();dgPresenceStart();},delay);
}
function dgPresenceStart(){
 try{
  if(typeof USER==="undefined"||!USER||typeof sb==="undefined"||!sb||typeof sb.channel!=="function")return;
  if(DG_PRES&&DG_PRES_USER===String(USER.id))return;
  if(DG_PRES)dgPresenceStop();
  const generation=++DG_PRES_GENERATION;DG_PRES_USER=String(USER.id);DG_PRES_STATE="connecting";dgPresenceEmit();
  const channel=DG_PRES=sb.channel("dg-presence",{config:{presence:{key:String(USER.id)+":"+DG_SID}}});
  channel.on("presence",{event:"sync"},()=>{if(generation===DG_PRES_GENERATION)dgPresenceEmit();});
  channel.subscribe(st=>{
   if(generation!==DG_PRES_GENERATION)return;
   if(st==="SUBSCRIBED"){
    DG_PRES_OK=true;DG_PRES_STATE="on";DG_PRES_RETRY=0;
    clearTimeout(DG_PRES_WATCH);DG_PRES_WATCH=null;
    clearInterval(DG_PRES_HEARTBEAT);DG_PRES_HEARTBEAT=setInterval(()=>dgPresencePing(null,true),30000);
    DG_PRES_LAST=0;dgPresencePing(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash",true);dgPresenceEmit();
   }else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"||st==="CLOSED")dgPresenceFail(st);
  });
  DG_PRES_WATCH=setTimeout(()=>{if(generation===DG_PRES_GENERATION&&DG_PRES_STATE==="connecting")dgPresenceFail("WATCHDOG");},20000);
  (async()=>{try{const{data}=await sb.auth.getSession();const tok=data?.session?.access_token;
   if(generation===DG_PRES_GENERATION&&tok&&sb.realtime?.setAuth)await sb.realtime.setAuth(tok);
  }catch(e){}})();
 }catch(e){DG_PRES_OK=false;DG_PRES_STATE="error";dgPresenceEmit();if(DG_PRES)dgPresenceFail("START");}
}
function dgPresenceResume(){
 if(typeof USER==="undefined"||!USER)return;
 if(!DG_PRES_OK){dgPresenceStop();dgPresenceStart();}else dgPresencePing(null,true);
}
if(typeof window.addEventListener==="function")window.addEventListener("online",dgPresenceResume);
if(typeof document.addEventListener==="function")document.addEventListener("visibilitychange",()=>{if(!document.hidden)dgPresenceResume();});
/* 0045 · GELİŞMİŞ CANLI İZLEME (kullanıcı: "gerçek bir izleme olsun, daha
 * detaylı olsun"). VERİTABANINA YAZMAZ: tüm alanlar presence payload'ında
 * taşınır (geçici) — kanal düşince/sekmeler kapanınca buharlaşır. Yeni tablo/
 * migration/RLS YOK (kırmızı çizgi); gizlilik metnindeki mevcut beyanla birebir
 * uyumlu (konum yalnız GPS açıksa ve geçici). Yalnız kurucu sekmesi okur. */
const DG_SID=(()=>{try{return window.DG_VISITOR_SESSION_ID_STORE.load(sessionStorage);}catch(e){return "x";}})();
const DG_SESSION_START=Date.now();
const DG_DEV_TAG=(()=>{try{return window.DG_VISITOR_DEVICE_LABEL.build(navigator.userAgent);}catch(e){return "?";}})();
const DG_ACT_LABELS={save:"ölçüm kaydetti",edit:"kayıt güncelledi",park:"park algıladı",export:"dışa aktardı",publish:"rapor yayını istedi"};
const DG_VISITOR_ACTIVITY=window.DG_VISITOR_ACTIVITY_APPLICATION.create();
const DG_VISITOR_STORED_ACTIVITY=window.DG_VISITOR_STORED_ACTIVITY_APPLICATION.create();
const DG_VISITOR_STORED_ACTIVITY_STORE=window.DG_VISITOR_STORED_ACTIVITY_STORE.create();
const DG_VISITOR_LIVE_VISIT_COUNTS_STORE=window.DG_VISITOR_LIVE_VISIT_COUNTS_STORE.create();
const DG_VISITOR_SESSION_EVENTS=window.DG_VISITOR_SESSION_EVENTS_APPLICATION.create();
/* Sekme değişince çağrılır (shell go()): gezinme zincirine yazar. */
function dgPresenceView(v){
 try{
  if(!DG_VISITOR_SESSION_EVENTS.recordView(v))return;
  dgPresencePing(v,true);
 }catch(e){}
}
/* Önemli kullanıcı aksiyonunda çağrılır (kaydet/park/export/yayın). */
function dgPresenceAct(k,d){
 try{DG_VISITOR_SESSION_EVENTS.recordAction(k,d);dgPresencePing(null,true);}catch(e){}
}
function dgPresencePing(view,force){
 try{
  if(!DG_PRES||!DG_PRES_OK||typeof DG_PRES.track!=="function")return;
  const now=Date.now();
  if(!force&&now-DG_PRES_LAST<10000)return;
  DG_PRES_LAST=now;
  const p={id:String(USER.id),
   n:(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.full_name||PROFILE.email))||"?",
   r:(typeof PROFILE!=="undefined"&&PROFILE&&PROFILE.role)||"user",
   v:view||(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash"),t:now};
  /* 0040 (kullanıcı kararı): konum, GPS AÇIKSA kurucu görünümü için OTOMATİK
   * paylaşılır (ayrı anahtar yok) — GEÇİCİDİR, veritabanına yazılmaz; kayıt
   * onayında yönetici zaten saklı konumları görebilir. Park ORTAK kanalı
   * ayrıca kullanıcının 👥 anahtarına bağlıdır (map.js canlı paylaşım bayrağı). */
  if(typeof GPS!=="undefined"&&GPS&&GPS.latitude!=null){p.la=GPS.latitude;p.lo=GPS.longitude;
   DG_VISITOR_SESSION_EVENTS.recordLocation(p.la,p.lo,now);
  }
  /* 0045: oturum/cihaz/gezinti/aksiyon/iz — hep geçici presence alanı. */
  p.sid=DG_SID;p.st=DG_SESSION_START;p.dev=DG_DEV_TAG;
  const {views:DG_VIEW_HIST,lastAction:DG_LAST_ACT,locations:DG_LOC_HIST}=DG_VISITOR_SESSION_EVENTS.snapshot();
  if(DG_VIEW_HIST.length)p.vh=DG_VIEW_HIST;
  if(DG_LAST_ACT)p.act=DG_LAST_ACT;
  if(p.la!=null&&DG_LOC_HIST.length>1)p.lh=DG_LOC_HIST;
  p.hidden=!!document.hidden;
  const channel=DG_PRES,generation=DG_PRES_GENERATION;
  Promise.resolve(channel.track(p)).then(status=>{if(generation===DG_PRES_GENERATION&&status!=="ok")dgPresenceFail("TRACK");}).catch(()=>{if(generation===DG_PRES_GENERATION)dgPresenceFail("TRACK");});
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
 const open=w.style.display!=="none";
 DG_VISITOR_ACTIVITY_DISCLOSURE_UI.render(w,b,!open,{translate:T});
 try{localStorage.setItem("dg_vis_act_open",open?"0":"1");}catch(e){}
}
function dgVisActRestore(){
 const w=$("visActivityWrap"),b=$("visActToggle");if(!w)return;
 const T=(x)=>(typeof dgCf==="function"?dgCf(x):x);
 let open=true;try{open=localStorage.getItem("dg_vis_act_open")!=="0";}catch(e){}
 DG_VISITOR_ACTIVITY_DISCLOSURE_UI.render(w,b,open,{translate:T});
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
 if(!dgVisAllowed())return;
 try{
  const counts=await DG_VISITOR_LIVE_VISIT_COUNTS_STORE.load(sb);
  if($("vzTotal"))$("vzTotal").textContent=counts.total;
  if($("vzToday"))$("vzToday").textContent=counts.today;
  if($("vz7"))$("vz7").textContent=counts.sevenDays;
 }catch(e){}
}
function dgVisAllowed(){return typeof PROFILE!=="undefined"&&PROFILE?.role==="owner";}
const DG_VISITOR_ROSTER=window.DG_VISITOR_ROSTER_APPLICATION.create();
function dgVisHasLocation(p){return DG_VISITOR_ROSTER.hasLocation(p);}
function dgVisRows(){
 let st={};try{st=dgPresenceList();}catch(e){}
 return DG_VISITOR_ROSTER.rows(st,Date.now(),dgPresenceReady());
}
function dgVisFilter(rows){return DG_VISITOR_ROSTER.filter(rows,{query:$("visSearch")?.value||"",view:$("visViewFilter")?.value||"",located:!!$("visLocated")?.checked});}
function dgVisResetFilters(){for(const id of ["visSearch","visViewFilter"]){const el=$(id);if(el)el.value="";}const located=$("visLocated");if(located)located.checked=false;renderVisitorsLive();}
function dgVisQuick(view,located){
 const search=$("visSearch"),filter=$("visViewFilter"),loc=$("visLocated");
 if(search)search.value="";
 if(filter)filter.value=view||"";
 if(loc)loc.checked=!!located;
 renderVisitorsLive();
}
function dgVisPause(on){DG_VIS_PAUSED=!!on;if(!on)renderVisitorsLive();else if($("visStatus"))$("visStatus").textContent="Görünüm duraklatıldı";}
function dgVisFit(){DG_VIS_FIT=false;dgVisMapDraw(dgVisFilter(dgVisRows()));}
function renderVisitorsLive(){
 if(!dgVisAllowed()||DG_VIS_PAUSED||document.hidden||(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW!=="visitors"))return;
 const box=$("visLive");
 const all=dgVisRows(),rows=dgVisFilter(all);
 if($("vzOnline"))$("vzOnline").textContent=all.length;
 if($("vzLocated"))$("vzLocated").textContent=all.filter(r=>dgVisHasLocation(r.p)).length;
 if($("visStatus")){const st=dgPresenceState();$("visStatus").textContent=(st==="on"?"Canlı bağlantı":"Bağlantı: "+st)+" · "+rows.length+" / "+all.length+" kullanıcı · "+new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});const wrap=$("visStatus").closest(".visitor-connection");if(wrap)wrap.dataset.state=st;}
 if(box){
  const T=(s)=>(typeof dgCf==="function"?dgCf(s):s);
  DG_VISITOR_ROSTER_UI.render(box,rows,{state:dgPresenceState(),allCount:all.length,viewLabels:DG_VIEW_LABELS,actionLabels:DG_ACT_LABELS,hasLocation:dgVisHasLocation,deviceLabel:r=>r.p.dev,translate:T,escape:esc});
  dgVisFeed(rows);
 }
 dgVisMapDraw(rows);
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
 const el=$("visMap");
 if(!el||DG_VIS_MAP||typeof L==="undefined")return;
 try{
  DG_VIS_MAP=L.map("visMap").setView([39,35],6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(DG_VIS_MAP);
  DG_VIS_LAYER=L.layerGroup().addTo(DG_VIS_MAP);
 }catch(e){DG_VIS_MAP=null;}
}
function dgVisMapDraw(rows){
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
 if(!dgVisAllowed())return;
 const box=$("visActivity");if(!box)return;
 const T=(s)=>(typeof dgCf==="function"?dgCf(s):s);
 const loc=(typeof DG_LANG!=="undefined"&&DG_LANG==="en")?"en-GB":"tr-TR";
 const datasets=await DG_VISITOR_STORED_ACTIVITY_STORE.load(sb);
 const translateValue=value=>typeof dgT==="function"?dgT(value||""):value;
 const rows=DG_VISITOR_STORED_ACTIVITY.build(datasets,{translate:T,translateValue});
 DG_VISITOR_DATABASE_ACTIVITY_UI.render(box,rows,{locale:loc,translate:T,escape:esc});
}

/* 0040: elle yenileme + 10 sn otomatik tik (yalnız sekme açıkken) + odaklanma */
async function dgVisRefresh(){if(!dgVisAllowed()||DG_VIS_REFRESHING)return;dgPresenceResume();DG_VIS_REFRESHING=true;try{renderVisitorsLive();await Promise.all([dgVisCounts(),dgVisActivity()]);}finally{DG_VIS_REFRESHING=false;}}
let DG_VIS_TIMER=null;
function dgVisTickStart(){dgVisTickStop();DG_VIS_TIMER=setInterval(()=>{try{if(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW==="visitors")renderVisitorsLive();}catch(e){}},10000);}
function dgVisTickStop(){if(DG_VIS_TIMER){clearInterval(DG_VIS_TIMER);DG_VIS_TIMER=null;}}
function dgVisFocus(la,lo){try{if(!dgVisAllowed()||!dgVisHasLocation({la,lo}))return;const follow=$("visFollow");if(follow)follow.checked=false;if(DG_VIS_MAP)DG_VIS_MAP.setView([la,lo],16);}catch(e){}}
