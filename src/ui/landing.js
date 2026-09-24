"use strict";
/* DendroGeo · ui/landing.js — LANDING MODÜLÜNÜN BEYNİ.
 * index.html inline script'indeki initLanding() birebir buraya taşındı (Faz 1).
 *
 * Landing'in kullandığı SABİT API (bunlar dışında hiçbir şeye dokunmaz):
 *   $, esc            → src/config/constants.js
 *   sb                → src/config/supabase.js
 *   L                 → vendor/leaflet
 *   loadApprovedMarkers → src/services/map.js
 *   renderAnalysis    → src/services/dash.js
 *   trackVisit        → src/services/admin.js (visit-stats)
 *   worldMapL         → src/ui/state.js
 * Landing markup'ı partials/landing.html'de, stilleri css/landing.css'tedir. */
function initLanding(){
 $("landing").style.display="block";$("shell").style.display="none";
 if(worldMapL)worldMapL.remove();
 worldMapL=L.map("worldMapLanding").setView([39,35],3);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(worldMapL);
 (async()=>{
  try{
   const g=await sb.from("v_global").select("*").single();
   if(g.data){$("stRec").textContent=g.data.records||0;$("stCountry").textContent=g.data.countries||0;$("stCity").textContent=g.data.cities||0;$("stCarbon").textContent=g.data.carbon_t||0;
       $("statRec").textContent=g.data.records||0;$("statCountry").textContent=g.data.countries||0;$("statCity").textContent=g.data.cities||0;$("statCarbon").textContent=g.data.carbon_t||0;}
   const c=await sb.from("v_country").select("*");
   $("tblCountry").querySelector("tbody").innerHTML=(c.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" onclick="zoomToCountry('${esc(r.country)}')"><td>${esc(r.country)}</td><td>${r.records}</td><td>${r.carbon_t}</td><td>${r.avg_dbh}</td><td>${r.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>Henüz veri yok</td></tr>";
   const t=await sb.from("v_city").select("*");
    $("tblCity").querySelector("tbody").innerHTML=(t.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" onclick="zoomToCity('${esc(r.city)}')"><td>${esc(r.city)}</td><td>${r.records}</td><td>${r.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>Henüz veri yok</td></tr>";
   loadApprovedMarkers(worldMapL,2000,(n,rows)=>renderAnalysis(rows,"landingAnalysis"));
  }catch(e){}
 })();
 trackVisit();
}
