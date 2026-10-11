/* DendroGeo verified-map PNG export (presentation only, 2026-10-08).
 * Sidecar for the locked surface engine. Reads current Leaflet display
 * geometries and optional park-relative NDVI polygons, never writes analysis.
 * Does not use cross-origin tile screenshots or alter approved records. */
(function(){
 "use strict";
 const platform=window.DG_GIS_EXPORT_PLATFORM.create({document,getToast:()=>typeof toast==="function"?toast:null});
 const {read,notify}=platform;
 const sources=window.DG_GIS_EXPORT_SOURCES.create({
  getLandcover:()=>window.DG_LANDCOVER?.getLast?.(),
  getGridSession:()=>typeof DG_GRID_SESSION!=="undefined"?DG_GRID_SESSION:undefined,
  hasWaypoints:()=>typeof WP!=="undefined",getWaypoints:()=>WP,
  getLastWaypoints:()=>typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[],
  getParkAreaFunction:()=>typeof parkAreaHa!=="undefined"?parkAreaHa:undefined,
  getSurfaceTypes:()=>window.DG_SURFACE_REVIEW?.types,
  readProjectId:()=>Number(read("gridProject")?.value)
 });
 const presentation=window.DG_GIS_EXPORT_PRESENTATION;
 const classes=()=>presentation.classes(()=>typeof DG_LC_CLASSES!=="undefined"?DG_LC_CLASSES:null);
 function outline(ctx,pr,ring){
  if(!Array.isArray(ring)||!ring.length)return;
  window.DG_PARK_IMAGE_GEOMETRY.appendRing({context:ctx,projector:{X:pr.X||pr.x,Y:pr.Y||pr.y},ring});
 }
 function waitVegetation(sens,attempts=8){
  return window.DG_GIS_EXPORT_VEGETATION.waitForLayers(sens,{attempts,
   tiers:typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null,
   render:typeof dgSensRenderVegetation==="function"?dgSensRenderVegetation:null
  });
 }
 const eachRing=(tree,visit)=>window.DG_GIS_EXPORT_CANVAS.eachRing(tree,visit);
 const {render}=window.DG_GIS_EXPORT_WORKFLOW.create({
  platform,sources,classes,outline,waitVegetation,presentation,getLayoutApi:()=>window.DG_GIS_EXPORT_LAYOUT,
  getGeometryApi:()=>window.DG_PARK_IMAGE_GEOMETRY,getCanvasApi:()=>window.DG_GIS_EXPORT_CANVAS,
  draw:args=>window.DG_GIS_EXPORT_STANDARD_CANVAS.draw(args),save:args=>window.DG_GIS_EXPORT_DOWNLOAD.save(args),
  getParkRings:()=>typeof PARK_POLY!=="undefined"?PARK_POLY:undefined,
  getSensitivity:()=>window.DG_LC_SENS?.state,
  getTiersFunction:()=>typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null,
  getHoles:()=>typeof PARK_HOLES!=="undefined"?PARK_HOLES||[]:[],
  getParkName:()=>typeof DG_PARK!=="undefined"?DG_PARK?.name:null,
  getVegetationColors:()=>typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS:{sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"}
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
  getSensitivity:()=>window.DG_LC_SENS?.state,
  getParkName:()=>typeof DG_PARK!=="undefined"?DG_PARK?.name:null,
  getParkRings:()=>typeof PARK_POLY!=="undefined"?PARK_POLY:undefined,
  getTiersFunction:()=>typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null,
  getEditSummary:rec=>typeof dgSensEditSummary==="function"?dgSensEditSummary(rec):null,
  getFeatureCount:rec=>typeof dgSensFeatures==="function"?dgSensFeatures().length:(rec.features||[]).length,
  getAreas:rec=>typeof dgSensAreas==="function"?dgSensAreas():rec.acceptedResult?.areas||rec.acceptedAreas||null,
  getHoles:()=>typeof PARK_HOLES!=="undefined"?PARK_HOLES||[]:[],getCanvasApi:()=>window.DG_GIS_EXPORT_CANVAS,
  getSurfaceColors:()=>typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS:null,
  getVegetationColors:()=>typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS:null
 });
 window.DG_GIS_EXPORT_BOOTSTRAP.install({document,window,events:window.DG_GIS_EXPORT_EVENTS,
  render,renderVerified,notify,classes,eachRing,console});
})();
