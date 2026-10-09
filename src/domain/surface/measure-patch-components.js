"use strict";
/* Saf yüzey patch metrikleri: bileşen alanı, alan ağırlıklı merkez ve eşik.
 * Raster hücre alanlarını yeniden hesaplamaz; verilen areaM2 değerlerini kullanır. */
(function(root){
function dgSurfaceSummarizePatchComponents(components,minHa){
  const threshold=(minHa==null?0.05:minHa)*10000;
  const measured=[];
  for(const cells of components){
    const areaM2=cells.reduce((total,cell)=>total+(cell.areaM2||0),0);
    if(areaM2<threshold)continue;
    let weightedLat=0,weightedLon=0;
    for(const cell of cells){
      const area=cell.areaM2||0;
      weightedLat+=cell.center.lat*area;
      weightedLon+=cell.center.lon*area;
    }
    measured.push({cells,areaM2,centroid:{lat:weightedLat/areaM2,lon:weightedLon/areaM2}});
  }
  measured.sort((a,b)=>b.areaM2-a.areaM2);
  return measured;
}
root.DG_SURFACE_PATCH_METRICS=Object.freeze({summarizeComponents:dgSurfaceSummarizePatchComponents});
})(typeof window!=="undefined"?window:globalThis);
