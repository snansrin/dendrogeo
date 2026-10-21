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
  if(window.DG_DOWNLOAD_BLOB)return window.DG_DOWNLOAD_BLOB.download(name,mime,text,{BlobCtor:Blob,urlApi:URL,document,schedule:(fn,delay)=>setTimeout(fn,delay)});
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
      "Ölçüm noktası yok"
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
    " ölçüm noktası",
    "ok",
    "📥"
  );
}

/* =========================================================
   LAND-COVER BRIDGE
   Numeric analysis lives in src/services/landcover.js.
========================================================= */

async function runLandCoverAnalysis(){
  return dgParkLandCoverUi.run();
}

const dgParkLandCoverUi=window.DG_PARK_LANDCOVER_UI.create({
  isBusy:()=>window._dgLandCoverBusy,
  setBusy:value=>{window._dgLandCoverBusy=value;if(value)DG_ACCEPTED_PARK_SURFACE.clear();},
  getLandcover:()=>window.DG_LANDCOVER,
  ensureLulc:typeof dgEnsureLulc==="function"?()=>dgEnsureLulc():null,
  getOuter:()=>PARK_POLY,
  getHoles:()=>PARK_HOLES,
  parkAreaM2:()=>parkAreaM2(),
  getElement:id=>document.getElementById(id),
  getButton:()=>$("landCoverBtn"),
  getReport:()=>$("landCoverReport"),
  getReportRenderer:()=>window.DG_LANDCOVER_RENDER_REPORT,
  getSensitivity:()=>window.DG_LC_SENS?{mount:host=>window.DG_LC_SENS.mount(host,{freshAnalysis:true})}:null,
  hasSensitivityRecord:()=>Boolean(window.DG_LC_SENS?.state?.record),
  toast:(...args)=>toast(...args),
  cf:value=>dgCf(value),
  escape:value=>esc(value)
});

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
