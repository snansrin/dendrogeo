"use strict";
/* Deterministic CSV and GeoJSON payloads for the reviewed surface export. */
(function(root){
 function geoJson({parts,vegetation,profile,fingerprint,acceptedAt,view,cellKey,unproject,epsg}){
  return{type:"FeatureCollection",features:parts.map(p=>{const key=cellKey(p.cell),e=profile[key];return{type:"Feature",properties:{row:p.cell.row,column:p.cell.col,original_class:p.cell.classKey,review_class:p.type,group:p.group,area_m2:p.areaM2,method:p.method,vegetation_ndvi_relative_class:p.type==="green"?(vegetation.tiers.get(key)||null):null,ndvi_median_season:e?.ndviMedianYear??null,ndvi_observation_days:e?.ndviObs??e?.yearObs??null,source_fingerprint:fingerprint,accepted_at:acceptedAt||null,view},geometry:{type:"MultiPolygon",coordinates:unproject(p.geom,epsg)}};})};
 }
 function csv({areas,view,fingerprint}){
  return"\uFEFFclass,area_m2,area_ha,view,source_fingerprint\n"+Object.keys(areas).map(k=>[k,areas[k],areas[k]/10000,view,fingerprint].join(",")).join("\n");
 }
 root.DG_BUILD_SURFACE_EXPORT_DATA=Object.freeze({geoJson,csv});
})(window);
