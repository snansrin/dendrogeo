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

  /* BİRİNCİL ve çapraz kaynak bağımsız ağ istekleri: aynı anda başlatılır.
   * Birincil kaynak QA'dan geçmeden sonuç yayınlanmaz; çapraz kaynak yalnız
   * bağımsız uzlaşma göstergesi üretir. */
  const primPromise=dgLcAnalyzeSource(DG_LC_SOURCES.primary,bbox,geom);
  const crossPromise=dgLcAnalyzeSource(DG_LC_SOURCES.cross,bbox,geom)
    .catch(err=>{
      const msg=String(err&&err.message||err);
      console.warn("DENDROGEO · çapraz doğrulama kaynağı atlandı:",msg);
      return null;
    });

  const prim=await primPromise;
  const result=prim.result;
  if(!(result.assignedAreaM2>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
  const deltaPct=Math.abs(result.assignedAreaM2-parkAreaM2)/parkAreaM2*100;
  if(deltaPct>0.5)throw new Error(
    "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. "+
    "Kısmi alan zorla yeniden dağıtılmadı."
  );

  /* ÇAPRAZ kaynak: IO LULC. Bu bağımsız kontrol birincil analizle aynı
   * anda yürütülür; böylece iki raster kaynağının toplam ağ gecikmesi
   * kullanıcıya seri şekilde yansımaz. Çapraz kaynak başarısız olursa
   * birincil gerçek sonuç korunur. */
  const cross=await crossPromise;
  const crossErr=cross?null:"Çapraz kaynak alınamadı.";

  /* YAPAY SU RAFİNASYONU:
   * ESA WorldCover 10 m rasterı küçük/yapay havuzları bazen yeşil veya
   * yapılı sınıfa atayabilir. OSM'deki açıkça water/pool/basin olarak
   * etiketlenmiş su geometrileri bağımsız vektör kanıtı olarak kullanılır.
   * Yalnızca hücre merkezi su geometrisinin içindeyse sınıf SU'ya çevrilir.
   * Rasterın ham kodu/rawCounts değiştirilmez; raporda rafine hücre sayısı
   * ayrıca belirtilir. OSM verisi yoksa veya alınamazsa raster sonucu aynen
   * korunur. */

  let waterRefined=0;
  try{
    const waterRings=await dgLcFetchWaterPolygons(bbox);
    waterRefined=dgLcRefineWater(result,waterRings);
    if(waterRefined>0){
      console.info("DENDROGEO · OSM su rafinasyonu:",waterRefined,"10 m hücre SU olarak işaretlendi.");
    }
  }catch(err){
    console.warn("DENDROGEO · OSM su rafinasyonu atlandı:",String(err&&err.message||err));
  }

  /* ASFALT/SERT YOL RAFİNASYONU:
   * Raster 10 m sınıfı dar asfalt yolları çevredeki yeşil/çıplak sınıfla
   * karıştırabilir. OSM'deki gerçek highway geometrisi hücreyle kesişiyorsa
   * hücre sert olarak işaretlenir. Sabit alan katsayısı uygulanmaz. */
  let roadRefined=0;
  try{
    const roadFeatures=await dgLcFetchRoadFeatures(bbox);
    const roadEpsg=dgLcUtmEpsgForLatLon(
      Number(outer?.[0]?.[0]?.[0]??40),
      Number(outer?.[0]?.[0]?.[1]??32)
    );
    roadRefined=dgLcRefineHardByOsm(result,roadFeatures,roadEpsg);
    if(roadRefined>0){
      console.info("DENDROGEO · OSM yol rafinasyonu:",roadRefined,"10 m hücre SERT olarak işaretlendi.");
    }
  }catch(err){
    console.warn("DENDROGEO · OSM yol rafinasyonu atlandı:",String(err&&err.message||err));
  }

  const patches=dgLcDetectPatches(result.cells);
  const agreement=cross?dgLcGroupAgreement(result,cross.result):null;

  const report={
    year:DG_LC_SOURCES.primary.year,
    crossYear:DG_LC_SOURCES.cross.year,
    resolutionM:DG_LC_PIXEL_M,
    primaryLabel:DG_LC_SOURCES.primary.label,
    crossLabel:DG_LC_SOURCES.cross.label,
    primaryCitation:DG_LC_SOURCES.primary.citation,
    crossCitation:DG_LC_SOURCES.cross.citation,
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
