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
/* HARİTA TEMBEL KURULUR (2026-09-25): landing haritası ve ~2000 işaretçi,
 * ilk yüklemede uygulama script'leriyle bant genişliği için yarışıyordu.
 * Artık eleman görünür alana yaklaşınca (rootMargin 400px) kuruluyor; hiç
 * gelmezse 6 sn sonra yedek kurulum yapılır (istatistikler hemen görünür). */
let DG_LANDING_MARKERS_PENDING=false;

function dgLandingMapInit(){
 const el=$("worldMapLanding");
 if(!el)return;
 if(worldMapL){if(worldMapL.invalidateSize)worldMapL.invalidateSize();return;}
 worldMapL=L.map("worldMapLanding").setView([39,35],3);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(worldMapL);
 if(DG_LANDING_MARKERS_PENDING){
  DG_LANDING_MARKERS_PENDING=false;
  dgLandingMarkers();
 }
}

/* Landing işaretçileri (2026-09-26): loadApprovedMarkers artık hatayı 3.
 * argümanla döndürüyor. Anon ziyaretçide measurements herkese açık ama
 * ağ/JWT sorunu olursa landing haritası boş kalıyordu; sebep konsola yazılır
 * ve ziyaretçiye kısa bir not gösterilir. */
function dgLandingMarkers(){
 return loadApprovedMarkers(worldMapL,2000,(n,rows,err)=>{
  if(err){
   console.warn("DENDROGEO · landing işaretçileri yüklenemedi:",err);
   const box=$("landingMapNote");
   if(box){box.style.display="";box.textContent="⚠ Onaylı noktalar şu an yüklenemedi: "+err;}
   return;
  }
  renderAnalysis(rows,"landingAnalysis");
 });
}

function dgLandingMapWhenVisible(){
 const el=$("worldMapLanding");
 if(!el||!("IntersectionObserver" in window)){dgLandingMapInit();return;}
 const io=new IntersectionObserver(es=>{
  if(es.some(e=>e.isIntersecting)){io.disconnect();dgLandingMapInit();}
 },{rootMargin:"400px"});
 io.observe(el);
 setTimeout(()=>{if(!worldMapL)dgLandingMapInit();},6000);
}

/* MOBİL MENÜ (0035 · P1-6): erişilebilir disclosure — aria-expanded/controls,
 * Esc ile kapanır, bölüm linkine basınca kapanır. Desktop'ta düğme display:none. */
function dgNavToggle(force){
 const l=$("navLinks"),b=$("navToggle");
 if(!l||!b)return;
 const open=(force===undefined)?!l.classList.contains("open"):!!force;
 l.classList.toggle("open",open);
 b.setAttribute("aria-expanded",open?"true":"false");
}
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"){const l=$("navLinks");if(l&&l.classList.contains("open"))dgNavToggle(false);}
});
document.addEventListener("click",e=>{
 const l=$("navLinks");
 if(l&&l.classList.contains("open")&&e.target.closest&&e.target.closest("#navLinks a"))dgNavToggle(false);
});

function initLanding(){
 $("landing").style.display="block";$("shell").style.display="none";
 dgLandingMapWhenVisible();
 /* Harita noktalarını istatistik sorgularından bağımsız başlat: bir yavaş
  * özet sorgusu, onaylı noktaların haritaya gelmesini bekletmemeli. */
 if(worldMapL)dgLandingMarkers();
 else DG_LANDING_MARKERS_PENDING=true;
 (async()=>{
  const jobs=[
   sb.from("v_global").select("*").single().then(g=>{
    if(g.error)throw g.error;
    if(g.data){$("statRec").textContent=g.data.records||0;$("statCountry").textContent=g.data.countries||0;$("statCity").textContent=g.data.cities||0;$("statCarbon").textContent=g.data.carbon_t||0;}
   }),
   sb.from("v_country").select("*").then(c=>{
    if(c.error)throw c.error;
    const table=$("tblCountry"),body=table&&table.querySelector&&table.querySelector("tbody");
    if(body)body.innerHTML=(c.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" tabindex="0" role="link" onkeydown="dgKeyActivate(event,this)" onclick="zoomToCountry('${esc(r.country)}')"><td>${esc(r.country)}</td><td>${r.records}</td><td>${r.carbon_t}</td><td>${r.avg_dbh}</td><td>${r.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>Henüz veri yok</td></tr>";
   }),
   sb.from("v_city").select("*").then(t=>{
    if(t.error)throw t.error;
    const table=$("tblCity"),body=table&&table.querySelector&&table.querySelector("tbody");
    if(body)body.innerHTML=(t.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" tabindex="0" role="link" onkeydown="dgKeyActivate(event,this)" onclick="zoomToCity('${esc(r.city)}')"><td>${esc(r.city)}</td><td>${r.records}</td><td>${r.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>Henüz veri yok</td></tr>";
   })
  ];
  const results=await Promise.allSettled(jobs);
  const errors=results.filter(r=>r.status==="rejected").map(r=>r.reason);
  if(errors.length){
   /* Üç bağımsız panelden biri aksasa bile diğer ikisi görünür kalır. */
   console.error("DENDROGEO · landing verisi kısmen yüklenemedi:",errors);
   toast("⚠ Genel istatistikler yüklenemedi (ağ/oturum). Sayfayı yenileyin.","warn","🌍");
  }
 })();
 trackVisit();
}

