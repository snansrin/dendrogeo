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

/* ═══════════ 0036 (T4) · CANLI VARLIK (presence) ═══════════
 * "Aktif kullanıcı eklensin ve ne yapıyor yazsın."
 * Supabase Realtime presence — GEÇİCİDİR: veritabanına YAZMAZ (KVKK dostu),
 * sekme kapanınca kendiliğinden düşer. Realtime kapalıysa sessizce devre dışı. */
const DG_VIEW_LABELS={dash:"Panel",measure:"Yeni Ölçüm",nav:"Waypoint",map:"Canlı Harita",projects:"Projeler",records:"Kayıtlarım",export:"Dışa Aktar",world:"Dünya Verisi",admin:"Ölçüm Yönetimi",users:"Kullanıcılar"};
let DG_PRES=null,DG_PRES_OK=false;
function dgPresenceStart(){
 try{
  if(DG_PRES||typeof sb==="undefined"||!sb||typeof sb.channel!=="function")return;
  if(typeof USER==="undefined"||!USER)return;
  DG_PRES=sb.channel("dg-presence",{config:{presence:{key:String(USER.id)}}});
  DG_PRES.on("presence",{event:"sync"},()=>{try{if(typeof dgRenderActive==="function")dgRenderActive();}catch(e){}});
  DG_PRES.subscribe(st=>{
   if(st==="SUBSCRIBED"){DG_PRES_OK=true;dgPresencePing(typeof DG_CUR_VIEW!=="undefined"?DG_CUR_VIEW:"dash");}
  });
 }catch(e){DG_PRES=null;DG_PRES_OK=false;}
}
function dgPresencePing(view){
 try{
  if(!DG_PRES||!DG_PRES_OK||typeof DG_PRES.track!=="function")return;
  DG_PRES.track({id:String(USER.id),n:(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.full_name||PROFILE.email))||"?",v:view||"dash",t:Date.now()});
 }catch(e){}
}
function dgPresenceList(){try{return (DG_PRES&&typeof DG_PRES.presenceState==="function")?DG_PRES.presenceState():{};}catch(e){return{};}}
function dgPresenceReady(){return !!DG_PRES_OK;}
