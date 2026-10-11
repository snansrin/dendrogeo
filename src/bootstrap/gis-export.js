/* Composition root for the modular GIS PNG exporters. */
(function(root){
 "use strict";
 function start({document,window,console,ports}){
 const platform=window.DG_GIS_EXPORT_PLATFORM.create({document,getToast:ports.getToast});
 const {read,notify}=platform;
 const sources=window.DG_GIS_EXPORT_SOURCES.create({
  getLandcover:ports.getLandcover,
  getGridSession:ports.getGridSession,
  hasWaypoints:ports.hasWaypoints,getWaypoints:ports.getWaypoints,
  getLastWaypoints:ports.getLastWaypoints,
  getParkAreaFunction:ports.getParkAreaFunction,
  getSurfaceTypes:ports.getSurfaceTypes,
  readProjectId:()=>Number(read("gridProject")?.value)
 });
 const presentation=window.DG_GIS_EXPORT_PRESENTATION;
 const classes=()=>presentation.classes(ports.getClasses);
 function outline(ctx,pr,ring){
  if(!Array.isArray(ring)||!ring.length)return;
  window.DG_PARK_IMAGE_GEOMETRY.appendRing({context:ctx,projector:{X:pr.X||pr.x,Y:pr.Y||pr.y},ring});
 }
 function waitVegetation(sens,attempts=8){
  return window.DG_GIS_EXPORT_VEGETATION.waitForLayers(sens,{attempts,
   tiers:ports.getTiersFunction(),
   render:ports.getVegetationRenderer()
  });
 }
 const eachRing=(tree,visit)=>window.DG_GIS_EXPORT_CANVAS.eachRing(tree,visit);
 const {render}=window.DG_GIS_EXPORT_WORKFLOW.create({
  platform,sources,classes,outline,waitVegetation,presentation,getLayoutApi:()=>window.DG_GIS_EXPORT_LAYOUT,
  getGeometryApi:()=>window.DG_PARK_IMAGE_GEOMETRY,getCanvasApi:()=>window.DG_GIS_EXPORT_CANVAS,
  draw:args=>window.DG_GIS_EXPORT_STANDARD_CANVAS.draw(args),save:args=>window.DG_GIS_EXPORT_DOWNLOAD.save(args),
  getParkRings:ports.getParkRings,
  getSensitivity:ports.getSensitivity,
  getTiersFunction:ports.getTiersFunction,
  getHoles:ports.getHoles,
  getParkName:ports.getParkName,
  getVegetationColors:()=>{const colors=ports.getVegetationColors();return colors!==undefined?colors:{sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"};}
 });

 // Restore the original 1240 × 1560 verified-map layout when NDVI is enabled.
 // The ordinary verified-map dialog and its existing exporter remain untouched
 // whenever NDVI is off. Reuse ONLY read-only Leaflet display geometry and
 // the already computed relative NDVI tiers; no raster or accepted area changes.
 const {renderVerified}=window.DG_GIS_EXPORT_VERIFIED_WORKFLOW.create({
  platform,sources,presentation,classes,outline,waitVegetation,
  prepare:args=>window.DG_PREPARE_VERIFIED_MAP_EXPORT.prepare(args),
  computeLayout:args=>window.DG_GIS_EXPORT_LAYOUT.computeVerified(args),
  drawCanvas:args=>window.DG_GIS_EXPORT_VERIFIED_CANVAS.draw(args),
  save:args=>window.DG_GIS_EXPORT_DOWNLOAD.save(args),
  getSensitivity:ports.getSensitivity,
  getParkName:ports.getParkName,
  getParkRings:ports.getParkRings,
  getTiersFunction:ports.getTiersFunction,
  getEditSummary:ports.getEditSummary,
  getFeatureCount:ports.getFeatureCount,
  getAreas:ports.getAreas,
  getHoles:ports.getHoles,getCanvasApi:()=>window.DG_GIS_EXPORT_CANVAS,
  getSurfaceColors:ports.getSurfaceColors,
  getVegetationColors:()=>ports.getVegetationColors()??null
 });
 window.DG_GIS_EXPORT_BOOTSTRAP.install({document,window,events:window.DG_GIS_EXPORT_EVENTS,
  render,renderVerified,notify,classes,eachRing,console});
  return window.DG_GIS_PNG_EXPORT;
 }
 root.DG_START_GIS_EXPORT=Object.freeze({start});
})(window);
