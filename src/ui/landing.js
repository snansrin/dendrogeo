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

function initLanding(){
 $("landing").style.display="block";$("shell").style.display="none";
 dgLandingMapWhenVisible();
 (async()=>{
  try{
   const g=await sb.from("v_global").select("*").single();
   if(g.data){$("stRec").textContent=g.data.records||0;$("stCountry").textContent=g.data.countries||0;$("stCity").textContent=g.data.cities||0;$("stCarbon").textContent=g.data.carbon_t||0;
       $("statRec").textContent=g.data.records||0;$("statCountry").textContent=g.data.countries||0;$("statCity").textContent=g.data.cities||0;$("statCarbon").textContent=g.data.carbon_t||0;}
   const c=await sb.from("v_country").select("*");
   $("tblCountry").querySelector("tbody").innerHTML=(c.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" onclick="zoomToCountry('${esc(r.country)}')"><td>${esc(r.country)}</td><td>${r.records}</td><td>${r.carbon_t}</td><td>${r.avg_dbh}</td><td>${r.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>Henüz veri yok</td></tr>";
   const t=await sb.from("v_city").select("*");
    $("tblCity").querySelector("tbody").innerHTML=(t.data||[]).slice(0,20).map(r=>`<tr class="clickable-row" onclick="zoomToCity('${esc(r.city)}')"><td>${esc(r.city)}</td><td>${r.records}</td><td>${r.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>Henüz veri yok</td></tr>";
   /* Harita henüz kurulmadıysa bayrak bırak: dgLandingMapInit kurulunca
    * işaretçileri kendisi yükler (yarış durumu olmasın). */
   if(worldMapL)dgLandingMarkers();
   else DG_LANDING_MARKERS_PENDING=true;
  }catch(e){
   /* SESSİZ HATA YUTMA KALDIRILDI (2026-09-26): landing istatistikleri
    * (v_global/v_country/v_city) patladığında sayılar 0 kalıyor ve ziyaretçi
    * "site boş/bozuk" izlenimi alıyordu. Sebep artık görünür. */
   console.error("DENDROGEO · landing verisi yüklenemedi:",e);
   toast("⚠ Genel istatistikler yüklenemedi (ağ/oturum). Sayfayı yenileyin.","warn","🌍");
  }
 })();
 trackVisit();
}


/* ========================================================================
 * PREMIUM MOTION · landing-only
 * Sadece görsel durum sınıfları ekler; veri akışına müdahale etmez.
 * ======================================================================== */
function dgInitPremiumMotion(){
 const root=document.getElementById("landing");
 if(!root)return;

 /* Scroll reveal: destek yoksa içerik görünür kalır. */
 const revealSelectors=[
  "section.blk > .wrap > .shead",
  "section.blk > .wrap > .cols",
  "section.blk > .wrap > .steps",
  "section.blk > .wrap > .grid",
  "section.blk > .wrap > #worldMapLanding"
 ];
 const reveal=[];
 revealSelectors.forEach(sel=>{
  try{root.querySelectorAll(sel).forEach(el=>reveal.push(el));}catch(_e){}
 });
 /* CSS selector içindeki olası child-combinator hatasını güvenli biçimde
  * ikinci bir basit taramayla tamamla. */
 root.querySelectorAll("section.blk .card, section.blk .feature, section.blk .steps, section.blk .grid").forEach(el=>{
  if(!reveal.includes(el))reveal.push(el);
 });

 reveal.forEach((el,i)=>{
  el.classList.add("dg-reveal");
  const d=i%5;
  if(d)el.classList.add("dg-delay-"+d);
 });

 const headings=[...root.querySelectorAll("section.blk .shead")];
 headings.forEach(h=>h.classList.add("dg-heading"));

 if("IntersectionObserver" in window){
  const io=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add("dg-visible");
    io.unobserve(entry.target);
   });
  },{rootMargin:"0px 0px -10% 0px",threshold:.08});
  reveal.forEach(el=>io.observe(el));
  headings.forEach(el=>io.observe(el));

  root.querySelectorAll(".step").forEach((el,i)=>{
   el.classList.add("dg-reveal");
   el.classList.add("dg-delay-"+Math.min(i+1,4));
   io.observe(el);
   const stepObserver=new IntersectionObserver(es=>{
    es.forEach(e=>{
     if(e.isIntersecting){
      e.target.classList.add("dg-step-active");
      stepObserver.unobserve(e.target);
     }
    });
   },{rootMargin:"0px 0px -18% 0px",threshold:.45});
   stepObserver.observe(el);
  });
 }else{
  reveal.forEach(el=>el.classList.add("dg-visible"));
  headings.forEach(el=>el.classList.add("dg-visible"));
 }

 /* Masaüstünde pointer parallax: yalnızca hero görselinde, çok düşük genlik. */
 if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    window.matchMedia("(min-width: 961px)").matches){
  const art=root.querySelector(".hero-art");
  if(art){
   let raf=0,px=0,py=0;
   const apply=()=>{
    raf=0;
    art.style.setProperty("--dg-px",px.toFixed(2)+"px");
    art.style.setProperty("--dg-py",py.toFixed(2)+"px");
   };
   root.addEventListener("pointermove",e=>{
    const r=root.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5;
    const y=(e.clientY-r.top)/Math.max(r.height,1)-.5;
    px=x*7;py=y*4;
    if(!raf)raf=requestAnimationFrame(apply);
   },{passive:true});
   root.addEventListener("pointerleave",()=>{
    px=0;py=0;
    if(!raf)raf=requestAnimationFrame(apply);
   },{passive:true});
  }
 }
}

/* Landing DOM'u hazır olduğunda çalıştır. */
if(document.readyState==="loading"){
 document.addEventListener("DOMContentLoaded",dgInitPremiumMotion,{once:true});
}else{
 dgInitPremiumMotion();
}
