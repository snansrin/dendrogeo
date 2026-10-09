"use strict";
/* DendroGeo · services/lc-engine.js — LULC sınıflandırma motoru (Faz 5)
 * Legacy global API adapterı. Raster, classification, source orchestration,
 * aggregation and export behavior lives in single-responsibility modules. */

function dgLcCodeToClass(code){
  return window.DG_SURFACE_CLASSIFICATION.codeToClass(code);
}

function dgLcReportClassForCode(code){
  return window.DG_SURFACE_CLASSIFICATION.reportClassForCode(code);
}

/* Grup eşlemesi kaynağa göre: ESA WorldCover kodları ile io-lulc kodları farklı. */
function dgLcGroupForCode(code,source){
  return window.DG_SURFACE_CLASSIFICATION.groupForCode(code,source);
}

/* Maskeli (hesaba katılmayan) kodlar: ESA'da yalnız NoData; io-lulc'da
 * NoData + kar + bulut. */
function dgLcIsMasked(code,source){
  return window.DG_SURFACE_CLASSIFICATION.isMasked(code,source);
}

/* Compatibility adapter: one tile's COG and park intersection is owned
 * by the injected raster adapter; preserve the legacy service entry point. */
function dgLcProcessTile(item,href,geometryWgs,source,signal){
  return window.DG_SURFACE_TILE_PROCESSOR.process(item,href,geometryWgs,source,signal);
}

/* Compatibility adapter: aggregation logic lives in its single-purpose
 * domain module; keep the existing global API stable for facade and QA. */
function dgLcMergeTileResults(parts){
  return window.DG_SURFACE_TILE_MERGER.merge(parts);
}

function dgLcClassCsv(result,meta){
  return window.DG_SURFACE_RESULT_EXPORTS.classCsv(result,meta);
}

function dgLcCellsGeoJson(result){
  return window.DG_SURFACE_RESULT_EXPORTS.cellsGeoJson(result);
}

/* İki kaynağın grup alanları arasındaki uzlaşma (belirsizlik göstergesi) */
function dgLcGroupAgreement(a,b){
  return window.DG_SURFACE_SOURCE_AGREEMENT.compare(a,b);
}

/* Tek kaynak için tam analiz zinciri */
function dgLcAnalyzeSource(src,bbox,geom){
  return window.DG_SURFACE_SOURCE_ANALYSIS.run(src,bbox,geom,{
    findTiles:dgLcFindTiles,
    getSas:dgLcGetSas,
    getDataAsset:dgLcGetDataAsset,
    signedHref:dgLcSignedHref,
    processTile:dgLcProcessTile,
    mergeTileResults:dgLcMergeTileResults,
    maxTiles:DG_LC_MAX_TILES,
    timeoutMs:90000
  });
}
