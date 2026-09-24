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
