"use strict";
/* DendroGeo · services/landcover.js — LULC FACADE (Faz 5'ten beri ince katman)
 *
 * Motor altı modüle bölündü (lc-config/geo/stac/engine/osm/patches) ve
 * rapor UI'ı ui/lc-report.js'e taşındı; bu dosya YALNIZCA dış sözleşmeyi
 * tutar: application use-case adapter'ı + window.DG_LANDCOVER API'si +
 * download sarmalayıcıları. Sözleşme DEĞİŞMEDİ: ui/park-export.js köprüsü
 * ve testler aynı yüzeyi kullanır. Bilimsel karar/orkestrasyon uygulama ve
 * domain katmanlarında; bu dosyada yalnız legacy API, görünüm ve dışa aktarım kalır.
 *
 * YÜKLEME SIRASI (index.html): lc-config → lc-geo → lc-stac → lc-engine →
 * lc-osm → lc-patches → ui/lc-report → domain/surface → application/surface → bu facade. */
const DG_RUN_SURFACE_ANALYSIS=window.DG_SURFACE_APPLICATION.createRunSurfaceAnalysis({
  ensureRaster:()=>window.dgEnsureGeoTIFF?window.dgEnsureGeoTIFF():Promise.resolve(),
  hasRaster:()=>!!window.GeoTIFF,
  getSources:()=>DG_LC_SOURCES,
  getPixelSize:()=>DG_LC_PIXEL_M,
  getBbox:dgLcBboxFromGeometry,
  analyzeSource:(...args)=>dgLcAnalyzeSource(...args),
  detectPatches:(...args)=>dgLcDetectPatches(...args),
  getClasses:()=>DG_LC_CLASSES,
  assertCoverage:window.DG_SURFACE_QUALITY.assertCoverage
});

async function dgLcAnalyze(params){
  const output=await DG_RUN_SURFACE_ANALYSIS.run(params);
  DG_LC_LAST=output;
  dgLcRenderObjects(output.patches);
  return output.report;
}

function downloadLandCoverClassCSV(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_"+(DG_LC_LAST.report?.year||2021)+"_classes.csv",
    "text/csv;charset=utf-8",
    dgLcClassCsv(DG_LC_LAST.result,{
      year:DG_LC_LAST.report?.year,
      resolutionM:DG_LC_PIXEL_M,
      primaryLabel:DG_LC_LAST.report?.primaryLabel
    })
  );
  toast("✓ Sınıf arazi örtüsü CSV'si indirildi.","ok","📥");
}

function downloadLandCoverCellsGeoJSON(){
  if(!DG_LC_LAST)return toast("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
  downloadBlob(
    "dendrogeo_landcover_"+(DG_LC_LAST.report?.year||2021)+"_10m_cells.geojson",
    "application/geo+json;charset=utf-8",
    JSON.stringify(dgLcCellsGeoJson(DG_LC_LAST.result),null,2)
  );
  toast("✓ 10 m hücre GeoJSON'u indirildi.","ok","📍");
}

function clearLandCover(){
  DG_LC_LAST=null;
  dgLcClearLayer();
}

window.DG_LANDCOVER_RENDER_REPORT=dgLcRenderReport;

window.DG_LANDCOVER={
  analyze:dgLcAnalyze,
  clear:clearLandCover,
  getLast:()=>DG_LC_LAST,
  isGreen:dgLcIsGreen,
  hasGreen:dgLcHasGreen,
  downloadClassCSV:downloadLandCoverClassCSV,
  downloadCellsGeoJSON:downloadLandCoverCellsGeoJSON
};

window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;

window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
