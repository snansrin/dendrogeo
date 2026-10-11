/* Legacy read-only bindings for modular GIS PNG export. */
(function(){
 "use strict";
 window.DG_START_GIS_EXPORT.start({document,window,console,ports:{
  getToast:()=>typeof toast==="function"?toast:null,
  getLandcover:()=>window.DG_LANDCOVER?.getLast?.(),
  getGridSession:()=>typeof DG_GRID_SESSION!=="undefined"?DG_GRID_SESSION:undefined,
  hasWaypoints:()=>typeof WP!=="undefined",getWaypoints:()=>WP,
  getLastWaypoints:()=>typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[],
  getParkAreaFunction:()=>typeof parkAreaHa!=="undefined"?parkAreaHa:undefined,
  getSurfaceTypes:()=>window.DG_SURFACE_REVIEW?.types,
  getClasses:()=>typeof DG_LC_CLASSES!=="undefined"?DG_LC_CLASSES:null,
  getTiersFunction:()=>typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null,
  getVegetationRenderer:()=>typeof dgSensRenderVegetation==="function"?dgSensRenderVegetation:null,
  getParkRings:()=>typeof PARK_POLY!=="undefined"?PARK_POLY:undefined,
  getSensitivity:()=>window.DG_LC_SENS?.state,
  getHoles:()=>typeof PARK_HOLES!=="undefined"?PARK_HOLES||[]:[],
  getParkName:()=>typeof DG_PARK!=="undefined"?DG_PARK?.name:null,
  getVegetationColors:()=>typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS:undefined,
  getEditSummary:rec=>typeof dgSensEditSummary==="function"?dgSensEditSummary(rec):null,
  getFeatureCount:rec=>typeof dgSensFeatures==="function"?dgSensFeatures().length:(rec.features||[]).length,
  getAreas:rec=>typeof dgSensAreas==="function"?dgSensAreas():rec.acceptedResult?.areas||rec.acceptedAreas||null,
  getSurfaceColors:()=>typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS:null
 }});
})();
