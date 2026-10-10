"use strict";
/* DendroGeo · services/visit-stats.js — ZİYARETÇİ SAYACI (Faz 6)
 * admin.js'ten birebir taşındı. trackVisit RLS-safe raw fetch + 
 * Prefer: return=minimal kullanır (Faz F kilidi: test/critical-fixes). */

/* ============ ZİYARETÇİ SAYACI ============ */
async function trackVisit(){
 try{
  if(sessionStorage.getItem("dg_visited"))return;
  sessionStorage.setItem("dg_visited","1");
  /* ⚠️ RLS: supabase-js insert() varsayılan olarak "Prefer: return=representation"
   * gönderir; anon rolünün site_visits üzerinde SELECT hakkı olmadığı için
   * RETURNING satırı RLS'e takılır → 401/42501 → sayaç SESSİZCE ölür (catch yutar).
   * Raw fetch + "Prefer: return=minimal" ile insert 201 döner (2026-09-24 canlı
   * doğrulandı). SB_URL/SB_KEY config/supabase.js'ten gelir; CSP connect-src
   * https://*.supabase.co zaten açık; sw.js POST'lara dokunmaz. */
  await fetch(SB_URL+"/rest/v1/site_visits",{
   method:"POST",
   headers:{
    "apikey":SB_KEY,
    "Authorization":"Bearer "+SB_KEY,
    "Content-Type":"application/json",
    "Prefer":"return=minimal"
   },
   body:JSON.stringify([{}])
  });
 }catch(e){}
}

async function loadVisitStats(){
 try{
  const total=await sb.from("site_visits").select("*",{count:"exact",head:true});
  $("aVisitTotal").textContent=total.count??0;
  const today=new Date();today.setHours(0,0,0,0);
  const t=await sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",today.toISOString());
  $("aVisitToday").textContent=t.count??0;
  const d7=new Date(Date.now()-7*86400000);
  const w=await sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",d7.toISOString());
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
const DG_SID=(()=>{try{let s=sessionStorage.getItem("dg_sid");if(!s){s=Math.random().toString(36).slice(2,10);sessionStorage.setItem("dg_sid",s);}return s;}catch(e){return "x";}})();
const DG_SESSION_START=Date.now();
const DG_DEV_TAG=(()=>{try{
 const ua=navigator.userAgent||"";
 const br=/Edg\//.test(ua)?"Edge":/OPR\//.test(ua)?"Opera":/Chrome\//.test(ua)?"Chrome":/Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":"?";
 const os=/Windows/.test(ua)?"Windows":/Android/.test(ua)?"Android":/iPhone|iPad|iPod/.test(ua)?"iOS":/Mac OS X/.test(ua)?"macOS":/Linux/.test(ua)?"Linux":"?";
 return (/Mobi|Android|iPhone|iPad|iPod/.test(ua)?"mobil":"masaüstü")+" · "+os+" · "+br;
}catch(e){return "?";}})();
let DG_VIEW_HIST=[],DG_LAST_ACT=null,DG_LOC_HIST=[];
const DG_ACT_LABELS={save:"ölçüm kaydetti",edit:"kayıt güncelledi",park:"park algıladı",export:"dışa aktardı",publish:"rapor yayını istedi"};
/* Sekme değişince çağrılır (shell go()): gezinme zincirine yazar. */
function dgPresenceView(v){
 try{
  const last=DG_VIEW_HIST[DG_VIEW_HIST.length-1];
  if(last&&last.v===v)return;
  DG_VIEW_HIST.push({v:v,t:Date.now()});
  if(DG_VIEW_HIST.length>8)DG_VIEW_HIST.shift();
  dgPresencePing(v,true);
 }catch(e){}
}
/* Önemli kullanıcı aksiyonunda çağrılır (kaydet/park/export/yayın). */
function dgPresenceAct(k,d){
 try{DG_LAST_ACT={k:k,t:Date.now(),d:String(d||"").slice(0,60)};dgPresencePing(null,true);}catch(e){}
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
   const lb=DG_LOC_HIST[DG_LOC_HIST.length-1];
   if(!lb||Math.abs(lb[0]-p.la)>1e-5||Math.abs(lb[1]-p.lo)>1e-5){DG_LOC_HIST.push([p.la,p.lo,now]);if(DG_LOC_HIST.length>12)DG_LOC_HIST.shift();}
  }
  /* 0045: oturum/cihaz/gezinti/aksiyon/iz — hep geçici presence alanı. */
  p.sid=DG_SID;p.st=DG_SESSION_START;p.dev=DG_DEV_TAG;
  if(DG_VIEW_HIST.length)p.vh=DG_VIEW_HIST.slice(-8);
  if(DG_LAST_ACT)p.act=DG_LAST_ACT;
  if(p.la!=null&&DG_LOC_HIST.length>1)p.lh=DG_LOC_HIST.slice(-12);
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
 w.style.display=open?"none":"";
 if(b){b.innerHTML=open?T("⬇ Göster"):T("⬆ Gizle");b.setAttribute("aria-expanded",String(!open));}
 try{localStorage.setItem("dg_vis_act_open",open?"0":"1");}catch(e){}
}
function dgVisActRestore(){
 const w=$("visActivityWrap"),b=$("visActToggle");if(!w)return;
 const T=(x)=>(typeof dgCf==="function"?dgCf(x):x);
 let open=true;try{open=localStorage.getItem("dg_vis_act_open")!=="0";}catch(e){}
 w.style.display=open?"":"none";
 if(b){b.innerHTML=open?T("⬆ Gizle"):T("⬇ Göster");b.setAttribute("aria-expanded",String(open));}
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
  const today=new Date();today.setHours(0,0,0,0);
  const d7=new Date(Date.now()-7*86400000);
  const[tt,td,tw]=await Promise.all([
   sb.from("site_visits").select("*",{count:"exact",head:true}),
   sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",today.toISOString()),
   sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",d7.toISOString())]);
  if($("vzTotal"))$("vzTotal").textContent=tt.count??0;
  if($("vzToday"))$("vzToday").textContent=td.count??0;
  if($("vz7"))$("vz7").textContent=tw.count??0;
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
if(!rows.length){
   const stt=dgPresenceState();
   box.textContent=stt==="on"?T(all.length?"Seçili filtrelere uyan kullanıcı yok. Filtreleri temizleyebilirsiniz.":"Şu an bağlı kullanıcı yok.")
    :stt==="connecting"?T("⏳ gerçek zamanlı katmana bağlanılıyor…")
    :T("Canlı bağlantı yeniden kuruluyor. Yenile düğmesiyle tekrar bağlanabilirsiniz.");
  }else{
   box.innerHTML=rows.map(r=>{
    const lbl=(DG_VIEW_LABELS[r.p.v]||r.p.v||"?");
    const ageTxt=r.age<60?r.age+" "+T("sn"):Math.round(r.age/60)+" "+T("dk");
    const hasLoc=dgVisHasLocation(r.p);
    const role=r.p.r==="owner"?"KURUCU":(r.p.r==="admin"?"DENETÇİ":"KULLANICI");
    const rc=r.p.r==="owner"?"on":(r.p.r==="admin"?"admin":"off");
    const ses=r.p.st?Math.max(0,Math.round((Date.now()-r.p.st)/60000)):null;
    const chain=(Array.isArray(r.p.vh)?r.p.vh:[]).slice(-3).map(h=>esc(T(DG_VIEW_LABELS[h.v]||h.v))).join(" → ");
    const actTxt=r.p.act?T(DG_ACT_LABELS[r.p.act.k]||r.p.act.k)+(r.p.act.d?" · "+esc(r.p.act.d):""):"";
    return '<div class="dg-vis-person" style="padding:6px 0;border-bottom:1px solid var(--line)'+(hasLoc?";cursor:pointer":"")+'"'+
     (hasLoc?' onclick="dgVisFocus('+Number(r.p.la)+','+Number(r.p.lo)+')" title="'+T("Haritada odaklan")+'"':'')+'>'+
     '<div style="display:flex;gap:8px;align-items:center">'+
     '<span style="width:9px;height:9px;border-radius:50%;background:var(--green);flex:0 0 auto"></span>'+
     '<b>'+esc(r.p.n||"?")+'</b>'+(r.p.hidden||r.age>120?'<span class="badge off">ARKA PLAN</span>':'')+
     '<span class="badge '+rc+'" style="font-size:.6rem">'+role+'</span>'+
     '<span style="color:var(--mut)">· '+esc(T(lbl))+(hasLoc?" 📍":"")+'</span>'+
     '<span class="dg-meta" style="margin-left:auto;white-space:nowrap">'+ageTxt+" "+T("önce")+'</span></div>'+
     '<div class="dg-meta" style="margin:3px 0 0 17px">'+
     (r.p.dev?"🖥 "+esc(r.p.dev)+" · ":"")+
     (ses!=null?T("oturum")+" "+ses+" "+T("dk")+" · ":"")+
     (chain?T("gezinti")+": "+chain:"")+
     (actTxt?" · "+T("son eylem")+": "+actTxt:"")+
     (r.p.lh&&r.p.lh.length>1?" · 🧭 "+T("iz")+" ("+r.p.lh.length+")":"")+
     '</div></div>';
   }).join("");
  }
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
 const ev=[];
 for(const r of (rows||[])){
  const who=r.p.n||"?";
  if(r.p.st)ev.push({t:r.p.st,who:who,k:T("çevrimiçi oldu"),d:r.p.dev||""});
  for(const h of (r.p.vh||[]))ev.push({t:h.t,who:who,k:T("görüntüledi"),d:T(DG_VIEW_LABELS[h.v]||h.v)});
  if(r.p.act)ev.push({t:r.p.act.t,who:who,k:T(DG_ACT_LABELS[r.p.act.k]||r.p.act.k),d:r.p.act.d||""});
 }
 ev.sort((a,b)=>b.t-a.t);
 const top=ev.slice(0,18);
 if(!top.length){box.textContent=T("—");return;}
 box.innerHTML=top.map(e=>{
  const hm=new Date(e.t).toLocaleTimeString(loc,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:.82rem">'+
   '<span class="mono" style="color:var(--mut);flex:0 0 auto">'+hm+'</span>'+
   '<b style="flex:0 0 auto">'+esc(e.who)+'</b>'+
   '<span>'+esc(e.k)+(e.d?' <span style="color:var(--mut)">· '+esc(e.d)+'</span>':"")+'</span></div>';
 }).join("");
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
  const ini=String(r.p.n||"?").trim().slice(0,1).toLocaleUpperCase("tr-TR");
  const ic=L.divIcon({className:"",html:'<div style="width:20px;height:20px;border-radius:50%;background:'+col+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">'+esc(ini)+'</div>',iconSize:[20,20],iconAnchor:[10,10]});
  const lbl=(DG_VIEW_LABELS[r.p.v]||r.p.v||"");
  const ageTxt=r.age<60?r.age+" "+T("sn"):Math.round(r.age/60)+" "+T("dk");
  /* 0045: geçici konum İZİ (presence lh) — kesikli polizgi, DB'ye yazılmaz. */
  if($("visTrails")?.checked&&Array.isArray(r.p.lh)&&r.p.lh.length>1){
   try{
    L.polyline(r.p.lh.filter(q=>Array.isArray(q)&&dgVisHasLocation({la:q[0],lo:q[1]})).slice(-30).map(q=>[q[0],q[1]]),{color:col,weight:2,opacity:.55,dashArray:"3 6",interactive:false}).addTo(DG_VIS_LAYER);
    L.circleMarker([r.p.lh[0][0],r.p.lh[0][1]],{radius:3,color:col,fillColor:"#fff",fillOpacity:.9,weight:2,interactive:false}).addTo(DG_VIS_LAYER);
   }catch(e){}
  }
  L.marker([r.p.la,r.p.lo],{icon:ic,interactive:true,keyboard:false,zIndexOffset:700}).addTo(DG_VIS_LAYER)
   .bindTooltip("<b>"+esc(r.p.n||"?")+"</b><br>"+esc(T(lbl))+"<br>"+T("son konum")+": "+ageTxt+" "+T("önce"),{direction:"top",offset:[0,-12]});
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
 const rows=[];
 const push=(t2,who,what,det)=>rows.push({t:t2,who:who,what:what,det:det});
 try{
  const{data}=await sb.from("measurements").select("id,point_id,species,status,created_at,profiles!measurements_owner_fkey(full_name)").order("created_at",{ascending:false}).limit(40);
  (data||[]).forEach(m=>push(m.created_at,(m.profiles&&m.profiles.full_name)||"—",T("ölçüm kaydı"),"P"+m.point_id+" · "+((typeof dgT==="function"?dgT(m.species||""):m.species)||"—")+" · "+((typeof dgT==="function"?dgT(m.status||""):m.status)||"—")));
 }catch(e){}
 try{
  const{data}=await sb.from("projects").select("id,name,created_at,profiles(full_name)").order("created_at",{ascending:false}).limit(20);
  (data||[]).forEach(p2=>push(p2.created_at,(p2.profiles&&p2.profiles.full_name)||"—",T("proje oluşturdu"),p2.name||""));
 }catch(e){}
 try{
  const{data}=await sb.from("data_requests").select("id,email,status,created_at").order("created_at",{ascending:false}).limit(20);
  (data||[]).forEach(r=>push(r.created_at,r.email||"—",T("veri talebi"),(typeof dgT==="function"?dgT(r.status||""):r.status)||"—"));
 }catch(e){}
 try{
  const{data}=await sb.from("report_requests").select("id,status,created_at,park_id").order("created_at",{ascending:false}).limit(20);
  (data||[]).forEach(r=>push(r.created_at,"—",T("rapor yayını istedi"),"park #"+r.park_id+" · "+((typeof dgT==="function"?dgT(r.status||""):r.status)||"—")));
 }catch(e){}
 rows.sort((a,b)=>String(b.t||"").localeCompare(String(a.t||"")));
 if(!rows.length){box.innerHTML='<div class="alert info">'+T("Etkinlik yok")+'</div>';return;}
 box.innerHTML='<table><thead><tr><th scope="col">'+T("Zaman")+'</th><th scope="col">'+T("Kim")+'</th><th scope="col">'+T("Ne yaptı")+'</th><th scope="col">'+T("Ayrıntı")+'</th></tr></thead><tbody>'+
  rows.slice(0,60).map(r=>{
   let d="—";try{d=r.t?new Date(r.t).toLocaleString(loc):"—";}catch(e){}
   return '<tr><td data-label="'+T("Zaman")+'" class="mono" style="white-space:nowrap">'+esc(d)+'</td><td data-label="'+T("Kim")+'">'+esc(String(r.who||"—"))+'</td><td data-label="'+T("Ne yaptı")+'">'+esc(String(r.what||"—"))+'</td><td data-label="'+T("Ayrıntı")+'">'+esc(String(r.det||"—"))+'</td></tr>';
  }).join("")+'</tbody></table>';
}

/* 0040: elle yenileme + 10 sn otomatik tik (yalnız sekme açıkken) + odaklanma */
async function dgVisRefresh(){if(!dgVisAllowed()||DG_VIS_REFRESHING)return;dgPresenceResume();DG_VIS_REFRESHING=true;try{renderVisitorsLive();await Promise.all([dgVisCounts(),dgVisActivity()]);}finally{DG_VIS_REFRESHING=false;}}
let DG_VIS_TIMER=null;
function dgVisTickStart(){dgVisTickStop();DG_VIS_TIMER=setInterval(()=>{try{if(typeof DG_CUR_VIEW!=="undefined"&&DG_CUR_VIEW==="visitors")renderVisitorsLive();}catch(e){}},10000);}
function dgVisTickStop(){if(DG_VIS_TIMER){clearInterval(DG_VIS_TIMER);DG_VIS_TIMER=null;}}
function dgVisFocus(la,lo){try{if(!dgVisAllowed()||!dgVisHasLocation({la,lo}))return;const follow=$("visFollow");if(follow)follow.checked=false;if(DG_VIS_MAP)DG_VIS_MAP.setView([la,lo],16);}catch(e){}}
