"use strict";
/* Explicit ports into existing park identity, geometry and analysis workflows. */
(function(root){
 const store=root.DG_PARK_STAGE_STORE.create(()=>sb);
 const verified=new WeakMap();
 let polygonPromise=null;
 root.DG_PARK_STAGES=root.DG_PARK_STAGE_WORKSPACE_UI.create({
  document,windowRef:root,escape:esc,store,area:geometry=>root.DG_PARK_AREA.polyArea(geometry),
  isBusy:()=>{const state=root.DG_LC_SENS?.state;return !!(root._dgLandCoverBusy||state?.busy||state?.saving||state?.exporting||state?.brush||state?.draw||state?.objectPick||state?.objectPreview||document.querySelector?.('#dgUxMapTools [data-tool][aria-pressed="true"]')||typeof dgMeasureSaving!=="undefined"&&dgMeasureSaving);},
  validate:async candidate=>{if(candidate.stageRow)verified.set(candidate,await store.resolve(candidate));},
  approveTransition:async()=>{if(root.DG_LC_SENS?.state?.record&&typeof dgSensSave==="function"&&!await dgSensSave())throw Error("Mevcut taslak kaydedilemedi. Etap değiştirilmedi.");return true;},
  clearAnalysis:()=>root.DG_LANDCOVER?.clear?.(),draw:async park=>{
   await drawPark(park);
   if(PARK_POLY!==root.DG_NORMALIZE_DRAWN_PARK_GEOMETRY.normalize(park)?.outer||DG_PARK_CAND!==park)return false;
   // Clear displayed/cached navigation only. Stored points and projects remain.
   WP=[];LAST_WP_ROWS=[];navTarget=null;
   const linked=PROJ_LIST.find(project=>Number(project.park_id)===Number(DG_PARK?.id));
   for(const id of ["mProject","nProject"]){const element=document.getElementById(id);if(element&&!(id==="mProject"&&EDIT_ID))element.value=linked?String(linked.id):"";}
   return true;
  },
  geometry:park=>root.DG_NORMALIZE_DRAWN_PARK_GEOMETRY.normalize(park)?{outer:root.DG_NORMALIZE_DRAWN_PARK_GEOMETRY.normalize(park).outer,inner:root.DG_NORMALIZE_DRAWN_PARK_GEOMETRY.normalize(park).holes}:null,
  polygon:()=>{if(root.polygonClipping)return Promise.resolve(root.polygonClipping);if(!polygonPromise)polygonPromise=dgLoadVendorScript("vendor/polygon-clipping-0.15.7.js").then(()=>root.polygonClipping).catch(error=>{polygonPromise=null;throw error;});return polygonPromise;},
  drawing:{document,leaflet:L,getMap:()=>map,getMode:()=>PARK_MODE,setMode:value=>{PARK_MODE=value;},getGuard:()=>!!root._dgSensGuard,setGuard:value=>{root._dgSensGuard=value;}}
 });
 root.DG_RESOLVE_STAGE_PARK=candidate=>verified.has(candidate)?Promise.resolve(verified.get(candidate)):store.resolve(candidate);
})(window);
