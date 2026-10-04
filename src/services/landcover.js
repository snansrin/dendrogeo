"use strict";
/* DendroGeo · services/landcover.js — LULC FACADE (Faz 5'ten beri ince katman)
 *
 * Motor altı modüle bölündü (lc-config/geo/stac/engine/osm/patches) ve
 * rapor UI'ı ui/lc-report.js'e taşındı; bu dosya YALNIZCA dış sözleşmeyi
 * tutar: dgLcAnalyze orkestrasyonu + window.DG_LANDCOVER API'si +
 * download sarmalayıcıları. Sözleşme DEĞİŞMEDİ: ui/park-export.js köprüsü
 * ve testler aynı yüzeyi kullanır.
 *
 * YÜKLEME SIRASI (index.html): lc-config → lc-geo → lc-stac → lc-engine →
 * lc-osm → lc-patches → ui/lc-report → bu dosya. */

async function dgLcAnalyze(params){
  /* Faz 7: GeoTIFF tembel yüklenir. Tarayıcıda dgEnsureGeoTIFF vardır;
   * QA vm bağlamında (scripts/lulc-qa.mjs) GeoTIFF önceden yüklüdür ve
   * ensure fonksiyonu tanımsızdır → guard atlanır. */
  if(window.dgEnsureGeoTIFF)await window.dgEnsureGeoTIFF();
  if(!window.GeoTIFF)throw new Error("10 m COG okuyucu yüklenmedi.");
  const outer=params?.outer||[];
  const holes=params?.holes||[];
  const parkAreaM2=Number(params?.parkAreaM2||0);
  if(!outer.length)throw new Error("Analiz için park polygonu yok.");
  if(!(parkAreaM2>0))throw new Error("Park alanı geçersiz.");

  const bbox=dgLcBboxFromGeometry(outer,holes);
  const geom={outer,holes};

  // A single immutable ESA WorldCover baseline. Other sources never relabel it.
  const primPromise=dgLcAnalyzeSource(DG_LC_SOURCES.primary,bbox,geom);
  const prim=await primPromise;
  const result=prim.result;
  if(!(result.assignedAreaM2>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
  const deltaPct=Math.abs(result.assignedAreaM2-parkAreaM2)/parkAreaM2*100;
  if(deltaPct>0.5)throw new Error(
    "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. "+
    "Kısmi alan zorla yeniden dağıtılmadı."
  );

  const cross=null,crossErr=null,waterRefined=0,roadRefined=0;
  const patches=dgLcDetectPatches(result.cells);
  const agreement=cross?dgLcGroupAgreement(result,cross.result):null;

  const report={
    year:DG_LC_SOURCES.primary.year,
    crossYear:DG_LC_SOURCES.cross.year,
    resolutionM:DG_LC_PIXEL_M,
    primaryLabel:DG_LC_SOURCES.primary.label,
    crossLabel:null,
    primaryCitation:DG_LC_SOURCES.primary.citation,
    crossCitation:null,
    parkAreaM2,
    rasterCoverageAreaM2:result.assignedAreaM2,
    classifiedAreaM2:result.classifiedAreaM2,
    maskedAreaM2:result.maskedAreaM2,
    sourceCells:result.sourceCells,
    groupCounts:result.groupCounts,
    groupAreasM2:result.groupAreas,
    rawCounts:result.rawCounts,
    rawAreasM2:result.rawAreas,
    patches:patches.map(pt=>({
      group:pt.classKey,
      areaHa:+(pt.areaM2/10000).toFixed(3),
      cells:pt.cells,
      centroidLat:+pt.centroid.lat.toFixed(6),
      centroidLon:+pt.centroid.lon.toFixed(6)
    })),
    agreement,
    waterRefinedCells:waterRefined,
    roadRefinedCells:roadRefined,
    crossError:crossErr,
    primaryItems:prim.items,
    crossItems:cross?cross.items:null,
    areaDeltaPct:deltaPct,
    classes:Object.fromEntries(DG_LC_CLASSES.map(cls=>{
      const area=result.groupAreas?.[cls.key]||0;
      const count=result.groupCounts?.[cls.key]||0;
      return[cls.key,{
        label:cls.label,
        emoji:cls.emoji,
        color:cls.color,
        count,
        areaM2:area,
        areaHa:+(area/10000).toFixed(3),
        pct:result.assignedAreaM2>0?+(area/result.assignedAreaM2*100).toFixed(2):0
      }];
    }))
  };

  DG_LC_LAST={report,result,crossResult:cross?cross.result:null,patches};
  dgLcRenderObjects(patches);
  return report;
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
