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
let DG_PRES=null,DG_PRES_OK=false,DG_PRES_STATE="idle",DG_PRES_RETRY=0,DG_PRES_LAST=0,DG_PRES_WATCH=null;
function dgPresenceState(){return DG_PRES_STATE;}
function dgPresenceReady(){return !!DG_PRES_OK;}
function dgPresenceEmit(){try{if(typeof renderVisitorsLive==="function")renderVisitorsLive();}catch(e){}}
function dgPresenceFail(why){
 DG_PRES_OK=false;DG_PRES_STATE="error";dgPresenceEmit();
 if(DG_PRES_RETRY<2){DG_PRES_RETRY++;
  setTimeout(()=>{try{if(DG_PRES&&sb&&sb.removeChannel)sb.removeChannel(DG_PRES);}catch(e){}
   DG_PRES=null;DG_PRES_STATE="idle";dgPresenceStart();},3000);}
}
function dgPresenceStart(){
 try{
  if(DG_PRES||typeof sb==="undefined"||!sb||typeof sb.channel!=="function")return;
  if(typeof USER==="undefined"||!USER)return;
  DG_PRES_STATE="connecting";
  DG_PRES=sb.channel("dg-presence",{config:{presence:{key:String(USER.id)}}});
  DG_PRES.on("presence",{event:"sync"},()=>{dgPresenceEmit();});
  DG_PRES.subscribe(st=>{
   if(st==="SUBSCRIBED"){
    DG_PRES_OK=true;DG_PRES_STATE="on";
    if(DG_PRES_WATCH){clearTimeout(DG_PRES_WATCH);DG_PRES_WATCH=null;}
    DG_PRES_LAST=0;
    dgPresencePing(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash",true);
    dgPresenceEmit();
   }else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"||st==="CLOSED"){dgPresenceFail(st);}
  });
  /* WATCHDOG: 8 sn sessizlik = takılı bağlantı → düşür, yeniden dene. */
  if(DG_PRES_WATCH)clearTimeout(DG_PRES_WATCH);
  DG_PRES_WATCH=setTimeout(()=>{if(DG_PRES_STATE==="connecting")dgPresenceFail("WATCHDOG");},8000);
  /* JWT'yi ARKA PLANDA yükselt (subscribe'ı bloklamaz). */
  (async()=>{try{
   const{data}=await sb.auth.getSession();
   const tok=data&&data.session&&data.session.access_token;
   if(tok&&sb.realtime&&sb.realtime.setAuth)sb.realtime.setAuth(tok);
  }catch(e){}})();
 }catch(e){DG_PRES=null;DG_PRES_OK=false;DG_PRES_STATE="error";}
}
function dgPresencePing(view,force){
 try{
  if(!DG_PRES||!DG_PRES_OK||typeof DG_PRES.track!=="function")return;
  const now=Date.now();
  if(!force&&now-DG_PRES_LAST<10000)return;
  DG_PRES_LAST=now;
  const p={id:String(USER.id),
   n:(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.full_name||PROFILE.email))||"?",
   v:view||(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash"),t:now};
  /* canlı konum: yalnız kullanıcı anahtarı AÇIK ve GPS varsa (geçici). */
  if(typeof DG_LIVE_ON!=="undefined"&&DG_LIVE_ON&&typeof GPS!=="undefined"&&GPS&&GPS.latitude!=null){p.la=GPS.latitude;p.lo=GPS.longitude;}
  DG_PRES.track(p);
 }catch(e){}
}
function dgPresenceList(){try{return (DG_PRES&&typeof DG_PRES.presenceState==="function")?DG_PRES.presenceState():{};}catch(e){return{};}}

/* ─────────── 👁 ZİYARETÇİ & CANLI (yalnız kurucu) ─────────── */
let DG_VIS_MAP=null,DG_VIS_LAYER=null;
async function loadVisitors(){
 if(typeof PROFILE==="undefined"||!PROFILE||PROFILE.role!=="owner")return;
 renderVisitorsLive();
 dgVisCounts();
 dgVisActivity();
}
async function dgVisCounts(){
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
function dgVisRows(){
 let st={};try{st=dgPresenceList();}catch(e){}
 const now=Date.now();const rows=[];
 for(const k in st)for(const p of (st[k]||[]))if(p&&p.id)rows.push({p:p,age:Math.max(0,Math.round((now-(p.t||now))/1000))});
 rows.sort((a,b)=>a.age-b.age);
 return rows;
}
function renderVisitorsLive(){
 const box=$("visLive");
 const rows=dgVisRows();
 if($("vzOnline"))$("vzOnline").textContent=rows.length;
 if(box){
  const T=(s)=>(typeof dgCf==="function"?dgCf(s):s);
  if(!rows.length){
   const stt=dgPresenceState();
   box.textContent=stt==="on"?T("(şu an başka kimse yok — kanal sessiz)")
    :stt==="connecting"?T("⏳ gerçek zamanlı katmana bağlanılıyor…")
    :T("⚠ Gerçek zamanlı katman etkin değil (Supabase → Dashboard → Realtime). Kart çalışmaya devam eder; canlı liste kapalı.");
  }else{
   box.innerHTML=rows.map(r=>{
    const lbl=(DG_VIEW_LABELS[r.p.v]||r.p.v||"?");
    const ageTxt=r.age<60?r.age+" "+T("sn"):Math.round(r.age/60)+" "+T("dk");
    const loc=(r.p.la!=null&&r.p.lo!=null)?" 📍":"";
    return '<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)">'+
     '<span style="width:9px;height:9px;border-radius:50%;background:#22c55e;flex:0 0 auto"></span>'+
     '<b>'+esc(r.p.n||"?")+'</b><span style="color:var(--mut)">· '+T(lbl)+loc+'</span>'+
     '<span class="dg-meta" style="margin-left:auto">'+ageTxt+" "+T("önce")+'</span></div>';
   }).join("");
  }
 }
 dgVisMapDraw(rows);
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
  if(r.p.la==null||r.p.lo==null)continue;
  pts.push(r);
  const col=(typeof dgMateColor==="function")?dgMateColor(r.p.id):"#2b6cb0";
  const ini=String(r.p.n||"?").trim().slice(0,1).toLocaleUpperCase("tr-TR");
  const ic=L.divIcon({className:"",html:'<div style="width:20px;height:20px;border-radius:50%;background:'+col+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">'+esc(ini)+'</div>',iconSize:[20,20],iconAnchor:[10,10]});
  const lbl=(DG_VIEW_LABELS[r.p.v]||r.p.v||"");
  const ageTxt=r.age<60?r.age+" "+T("sn"):Math.round(r.age/60)+" "+T("dk");
  L.marker([r.p.la,r.p.lo],{icon:ic,interactive:true,keyboard:false,zIndexOffset:700}).addTo(DG_VIS_LAYER)
   .bindTooltip("<b>"+esc(r.p.n||"?")+"</b><br>"+esc(T(lbl))+"<br>"+T("son konum")+": "+ageTxt+" "+T("önce"),{direction:"top",offset:[0,-12]});
 }
 try{
  if(pts.length===1)DG_VIS_MAP.setView([pts[0].p.la,pts[0].p.lo],13);
  else if(pts.length>1)DG_VIS_MAP.fitBounds(L.latLngBounds(pts.map(r=>[r.p.la,r.p.lo])).pad(0.35),{maxZoom:14});
 }catch(e){}
}
async function dgVisActivity(){
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
