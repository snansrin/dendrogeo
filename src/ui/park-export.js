"use strict";
/* DendroGeo · ui/park-export.js — DIŞA AKTARIM + LULC KÖPRÜSÜ (Faz 4)
 * gridplan.js'ten birebir taşındı: GeoJSON/CSV/PNG indirmeleri (vektörel
 * PNG çizimi dgPx* ile), runLandCoverAnalysis köprüsü (window.DG_LANDCOVER
 * sözleşmesi) ve download* sarmalayıcıları.
 * NOT: downloadLandCoverClassCSV/CellsGeoJSON landcover.js'te de tanımlı;
 * eskiden gridplan.js SONRA yüklendiği için onun sürümü kazanırdı — aynı
 * göreli sıra korundu (bu dosya landcover zincirinden sonra yüklenir). */

/* =========================================================
   LINE UTILITIES
========================================================= */


function downloadBlob(
  name,
  mime,
  text
){
  const b=
    new Blob(
      [text],
      {
        type:mime
      }
    );

  const u=
    URL.createObjectURL(b);

  const a=
    document.createElement(
      "a"
    );

  a.href=u;
  a.download=name;
  a.click();

  setTimeout(
    ()=>URL.revokeObjectURL(u),
    1000
  );
}

function downloadGridGeoJSON(){
  if(!DG_GRID_SESSION.getCells().length){
    return toast(
      "Önce grid"
    );
  }

  const fc=window.DG_PARK_EXPORT_FORMATS.gridGeoJSON(DG_GRID_SESSION.getCells());

  downloadBlob(
    "dendrogeo_grid.geojson",
    "application/geo+json",
    JSON.stringify(
      fc,
      null,
      2
    )
  );

  toast(
    "✓ Grid indirildi",
    "ok",
    "📥"
  );
}

function downloadWaypointsCSV(){
  const rows=
    LAST_WP_ROWS.length
      ?LAST_WP_ROWS
      :WP;

  if(
    !rows||
    !rows.length
  ){
    return toast(
      "WP yok"
    );
  }

  const csv=window.DG_PARK_EXPORT_FORMATS.waypointsCSV(rows);

  downloadBlob(
    "dendrogeo_wp.csv",
    "text/csv",
    csv
  );

  toast(
    "✓ "+
    rows.length+
    " WP",
    "ok",
    "📥"
  );
}

/* =========================================================
   LAND-COVER BRIDGE
   Numeric analysis lives in src/services/landcover.js.
========================================================= */

async function runLandCoverAnalysis(){
  if(window._dgLandCoverBusy){
    return toast("Arazi örtüsü analizi zaten çalışıyor.","info","🛰️");
  }

  /* Faz 8: LULC zinciri artık TEMBEL — ilk kullanımda sırayla yüklenir.
   * Yüklenemezse kullanıcıya sebep söylenir (sessiz başarısızlık yok). */
  if(!window.DG_LANDCOVER && typeof dgEnsureLulc==="function"){
    toast("🛰️ Arazi örtüsü modülü yükleniyor…","info");
    try{
      await dgEnsureLulc();
    }catch(err){
      return toast(dgCf("Arazi örtüsü modülü yüklenemedi: ")+((err&&err.message)||err),"err","🛰️");
    }
  }

  if(!window.DG_LANDCOVER || typeof window.DG_LANDCOVER.analyze!=="function"){
    return toast("10 m arazi örtüsü modülü yüklenmedi.","err","🗺️");
  }

  if(!PARK_POLY || !PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  window._dgLandCoverBusy=true;
  document.getElementById("v-map")?.classList.add("surface-review-active");
  const pending=document.getElementById("surfacePendingTools");if(pending)pending.style.display="flex";
  const pendingBase=document.getElementById("dgPendingBaseSelect");if(pendingBase)pendingBase.value=document.getElementById("baseLayerSelect")?.value||"osm";
  const btn=$("landCoverBtn");
  if(btn){
    btn.disabled=true;
    btn.dataset.oldText=btn.innerHTML;
    btn.innerHTML="⏳ Analiz yapılıyor…";
    btn.style.opacity=".65";
    btn.style.cursor="wait";
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML=
      "<b>🛰️ Arazi örtüsü analizi çalışıyor…</b>"+
      "<div style='font-size:.72rem;color:var(--mut);margin-top:6px'>"+
      "10 m raster verisi park polygonu ile kesiştiriliyor. Bu işlem bağlantıya göre biraz sürebilir; sonuç tamamlanmadan rapor yazılmayacak."+
      "</div>";
  }

  toast(
    "Arazi örtüsü analizi başladı. 10 m raster verisi okunuyor…",
    "info",
    "🛰️"
  );

  const parkArea=parkAreaM2();

  return window.DG_LANDCOVER.analyze({
    outer:PARK_POLY,
    holes:PARK_HOLES||[],
    parkAreaM2:parkArea
  }).then(async result=>{
    if(window.DG_LANDCOVER_RENDER_REPORT){
      window.DG_LANDCOVER_RENDER_REPORT(rep,result,parkArea);
    }
    /* 0054 · 🛰 UYDU HASSASİYET PANELİ: rapor barlarının hemen altında
     * belirir (kullanıcı isteği: "barlar gibi yatay bar — kaydırınca
     * hassasiyet artsın, uydu üstünde işaretlensin, kabul edince
     * kaydedilip öylece kalsın"). LULC zinciri zaten yüklü (bu köprünün
     * başında dgEnsureLulc koşuldu); mount başarısızsa analiz SONUCU
     * etkilenmez — typeof + try koruması. */
    if(window.DG_LC_SENS&&typeof window.DG_LC_SENS.mount==="function"){
      try{await window.DG_LC_SENS.mount("lcSens");}
      catch(e){console.warn("DENDROGEO · hassasiyet paneli monte edilemedi:",e);toast(dgCf("Yüzey düzenleme açılamadı: ")+String(e.message||e),"err");}
    }
    toast(
      "✓ 10 m arazi örtüsü analizi tamamlandı (ESA WorldCover 2021 + çapraz IO LULC 2020).",
      "ok",
      "🗺️"
    );
  }).catch(err=>{
    console.error("DENDROGEO · Arazi örtüsü analizi:",err);
    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "<b>❌ 10 m arazi örtüsü analizi tamamlanamadı.</b>"+
        "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+esc(err?.message||String(err))+"</div>"+
        "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>Geçersiz veya eksik sonuç rapora yazılmadı.</div>";
    }
    toast(dgCf("Arazi örtüsü analizi hatası: ")+(err?.message||String(err)),"err","🗺️");
  }).finally(()=>{
    window._dgLandCoverBusy=false;
    if(pending)pending.style.display="none";
    if(!window.DG_LC_SENS?.state?.record)document.getElementById("v-map")?.classList.remove("surface-review-active");
    if(btn){
      btn.disabled=false;
      btn.innerHTML=btn.dataset.oldText||"🌿 Yüzey Örtüsü Analizi";
      btn.style.opacity="";
      btn.style.cursor="";
    }
  });
}

function downloadLandCoverClassCSV(){
  if(window.DG_LANDCOVER && typeof window.DG_LANDCOVER.downloadClassCSV==="function"){
    return window.DG_LANDCOVER.downloadClassCSV();
  }
  return toast("CSV dışa aktarma modülü hazır değil.","err","📥");
}

function downloadLandCoverCellsGeoJSON(){
  if(window.DG_LANDCOVER && typeof window.DG_LANDCOVER.downloadCellsGeoJSON==="function"){
    return window.DG_LANDCOVER.downloadCellsGeoJSON();
  }
  return toast("GeoJSON dışa aktarma modülü hazır değil.","err","📍");
}

/* ---------------------------------------------------------------------------
 * PNG DIŞA AKTARIM (vektörel, karosuz)
 *
 * "🖼️ PNG İndir" butonu daha önce TANIMSIZ bir fonksiyonu çağırıyordu
 * (downloadParkImage hiç yazılmamıştı → ReferenceError). Bu gerçekleme
 * haritayı Leaflet/karo üzerinden değil, DOĞRUDAN VEKTÖREL çizerek üretir:
 *   · karo (tile) görüntüsü kullanılmaz → CORS/taint/offline sorunu YOK
 *   · her zaman çalışır, çıktısı temiz ve baskıya uygun
 * Katmanlar paneldeki anahtarlara bağlıdır: chkPngGrid / chkPngWp / chkPngCover.
 * ------------------------------------------------------------------------- */
function dgPxProjector(minLat,maxLat,minLon,maxLon,W,Htop,scale){
  return window.DG_PARK_IMAGE_GEOMETRY.project({minLat,maxLat,minLon,maxLon,width:W,heightTop:Htop,scale});
}

function dgPxRingPath(ctx,pr,ring){
  return window.DG_PARK_IMAGE_GEOMETRY.traceRing({context:ctx,projector:pr,ring});
}

function downloadParkImage(){
  if(!PARK_POLY||!PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }
  const chk=id=>{const e=document.getElementById(id);return !e||e.checked;};
  /* KULLANICI İSTEĞİ (2026-09-20): "png sadece parkın alanı olsun, onun
   * dışında bir şey gösterilmesin". Sınırlar YALNIZCA park polygonundan
   * türer (grid/WP sınırları büyütmez); çizim park polygonuna kırpılır:
   * park dışına kaymış waypoint/grid kalıntıları görünmez. */
  const opts={grid:chk("chkPngGrid"),wp:chk("chkPngWp"),cover:chk("chkPngCover"),clipPark:true};
  const lc=(window.DG_LANDCOVER&&window.DG_LANDCOVER.getLast)?window.DG_LANDCOVER.getLast():null;
  try{
    const layout=window.DG_PARK_EXPORT_LAYOUT.compute({
      outer:PARK_POLY,holes:PARK_HOLES||[],project:window.DG_PARK_IMAGE_GEOMETRY.project
    });
    if(!layout)return toast("Görüntü için sınır üretilemedi","err","🖼️");

    const {W,H}=layout;

    const cv=document.createElement("canvas");
    cv.width=W;cv.height=H;
    const ctx=cv.getContext("2d");
    const name=window.DG_PARK_EXPORT_CANVAS.draw({
      context:ctx,layout,options:opts,landcover:lc,outer:PARK_POLY,holes:PARK_HOLES||[],
      gridSession:()=>DG_GRID_SESSION,waypoints:()=>WP,classes:()=>DG_LC_CLASSES_SAF,
      areaM2:()=>parkAreaM2(),osmAttribution:()=>DG_ATTR_TEXT.osm,
      traceRing:(context,projector,ring)=>dgPxRingPath(context,projector,ring)
    });

    cv.toBlob(b=>{
      if(!b)return toast("PNG üretilemedi","err","🖼️");
      const u=URL.createObjectURL(b);
      const a=document.createElement("a");
      a.href=u;a.download=name;a.click();
      setTimeout(()=>URL.revokeObjectURL(u),1500);
      toast("✓ PNG indirildi ("+(b.size/1024).toFixed(0)+" KB)","ok","🖼️");
    },"image/png");
  }catch(err){
    console.error("DENDROGEO · PNG:",err);
    toast(dgCf("PNG hatası: ")+(err&&err.message||err),"err","🖼️");
  }
}

window.downloadParkImage=downloadParkImage;

/* DG_LC_CLASSES landcover.js'te (classic script global'i); yoksa düşme */
const DG_LC_CLASSES_SAF=(typeof DG_LC_CLASSES!=="undefined")?DG_LC_CLASSES:

window.runLandCoverAnalysis=runLandCoverAnalysis;

/* 0054: eski dgValOpen köprüsü (üç adımlı workbench) KALDIRILDI —
 * kullanıcı geri bildirimi: "çok karışık, daha basit ve işlevsel olsun."
 * Uydu hassasiyet paneli (ui/lc-sens.js) analiz bitiminde OTOMATİK monte
 * edilir (yukarıdaki .then bloğu); ayrı kart/düğme yoktur. */

window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;

window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
