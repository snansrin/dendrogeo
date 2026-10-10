"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar. */
const _tgr=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tgrf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));

/* DendroGeo · services/grid-engine.js — ÖRNEKLEM IZGARASI MOTORU (Faz 4)
 * gridplan.js'ten birebir taşındı: buildGrid (hücre üretimi + engel
 * tamponları), çizim/özet, hücre seçimi, görünürlük anahtarları ve
 * ızgaradan waypoint üretimi.
 * Bağımlılıklar (çağrı anında global): park-state.*, park-geometry.*,
 * leaflet L, $, esc, toast. */

/* =========================================================
   GRID
========================================================= */

let DG_GRID_EPOCH=0,DG_GRID_RENDERER=null,DG_GRID_SOURCE=null,DG_GRID_META="";
function dgGridReviewSignature(){return window.DG_GRID_REVIEW_SIGNATURE.resolve(window.DG_LC_SENS?.state);}
const DG_GRID_BUILD=window.DG_GRID_BUILD_APPLICATION.create({
 ensureSurface:()=>typeof dgEnsureLulc==="function"?dgEnsureLulc():undefined,
 isCurrent:({park,epoch})=>epoch===DG_GRID_EPOCH&&park===PARK_POLY,
 getGreenOnly:()=>DG_GREEN_ONLY,
 getLastCells:()=>typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.result?.cells:null,
 getReview:()=>window.DG_LC_SENS?.state,getSignature:dgGridReviewSignature,
 resolveEpsg:park=>dgLcUtmEpsgForLatLon(park[0][0][0],park[0][0][1]),
 prepareParts:({park,review,epsg,lastCells})=>window.DG_GRID_SURFACE_PARTS.prepare({
  review,lastCells,outer:park,holes:PARK_HOLES||[],epsg,
  osmElements:window.DG_SURFACE_OSM?.boundary===JSON.stringify(park)?window.DG_SURFACE_OSM.elements:[],
  resolveReviewParts:()=>window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,review.geometry,dgSensFeatures(),review.epsg,review.parkGeometry),
  prepare:dgSurfacePrepare
 }),
 buildRequest:({park,size,clearance,epsg,parts})=>window.DG_GRID_REQUEST.build({size,clearance,epsg,outer:park,holes:PARK_HOLES,greenOnly:DG_GREEN_ONLY,parts,waterRings:WATER_RINGS,imperviousRings:IMP_RINGS,waterLines:WATER_LINES,imperviousLines:IMP_LINES,gridBlockLines:GRID_BLOCK_LINES}),
 runWorker:request=>dgSurfaceWorkerJob(request),runGrid:request=>dgSurfaceGrid(request),
 resolveBounds:park=>window.DG_GRID_BOUNDS.resolve(park),
 fetchMeasurements:bounds=>window.DG_GRID_MEASUREMENT_STORE.fetchCandidates(sb,bounds),
 warnTruncated:(data,count)=>dgWarnIfTruncated(data,5000,"Izgara ölçüm yoğunluğu",count),
 countMeasurements:(result,data,{size,epsg})=>window.DG_GRID_CELL_MEASUREMENTS.count(result.cells,data,{size,epsg,x0:result.x0,y0:result.y0,project:dgLcUtmForward,pointDistance:dgGridPointDistance,featureGeometry:dgSurfaceFeatureGeometry})
});
const DG_GRID_BUILD_CONTROLLER=window.DG_GRID_BUILD_CONTROLLER_UI.create({
 getPark:()=>PARK_POLY,
 getOptions:()=>window.DG_GRID_OPTIONS.resolve($("gridSize")?.value,$("gridClearance")?.value),
 nextEpoch:()=>++DG_GRID_EPOCH,getButton:()=>$("gridBuildBtn"),
 build:context=>DG_GRID_BUILD(context),
 accept:(outcome,context)=>window.DG_GRID_BUILD_COMPLETION_UI.complete({
  outcome,clearance:context.clearance,clear:clearGrid,
  setSource:signature=>{DG_GRID_SOURCE=signature;},setMeta:meta=>{DG_GRID_META=meta;},
  cells:GRID_CELLS,render:drawGridLayer,translate:_tgr,translateFormat:_tgrf,
  notify:(...args)=>toast(...args)
 }),notify:(...args)=>toast(...args)
});
async function buildGrid(){return DG_GRID_BUILD_CONTROLLER();}

/* =========================================================
   GRID DRAW
========================================================= */

function drawGridLayer(){
  return window.DG_GRID_LAYER_UI.render({
    leaflet:L,map,previousLayer:GRID_LAYER,previousRenderer:DG_GRID_RENDERER,
    cells:GRID_CELLS,selection:SELECTED_CELLS,
    resolveStyle:(cell,selected)=>window.DG_GRID_CELL_STYLE.resolve(cell,selected),
    resolveShape:cell=>window.DG_GRID_CELL_SHAPE.resolve(cell),
    countStates:cells=>window.DG_GRID_CELL_STATES.count(cells),translateFormat:_tgrf,
    onSelect:(id,rect)=>toggleCellSelection(id,rect),
    onCreated:({layer,renderer})=>{GRID_LAYER=layer;DG_GRID_RENDERER=renderer;},
    updateSummary:(measured,empty)=>updateGridSummary(measured,empty)
  });
}

function updateGridSummary(
  g,
  r0
){
  window.DG_GRID_SUMMARY.render({
    element:$("gridSummary"),
    size:$("gridSize")?.value||20,
    total:GRID_CELLS.length,
    measured:g,
    empty:r0,
    selected:SELECTED_CELLS.size,
    meta:DG_GRID_META,
    translate:_tgr,
    translateFormat:_tgrf
  });
}

/* =========================================================
   CELL SELECTION
========================================================= */

const DG_GRID_SELECTION=window.DG_GRID_SELECTION_UI.create({
  getCells:()=>GRID_CELLS,getSelection:()=>SELECTED_CELLS,getLayer:()=>GRID_LAYER,
  resolveStyle:(cell,selected)=>window.DG_GRID_CELL_STYLE.resolve(cell,selected),
  countStates:cells=>window.DG_GRID_CELL_STATES.count(cells),
  updateSummary:(measured,empty)=>updateGridSummary(measured,empty)
});
function toggleCellSelection(cellId,rect){return DG_GRID_SELECTION.toggle(cellId,rect);}
function clearCellSelection(){return DG_GRID_SELECTION.clear();}

function clearGrid(){
  DG_GRID_META="";DG_GRID_SOURCE=null;
  ++DG_GRID_EPOCH;
  return window.DG_GRID_RESET_UI.clear({
    map,renderer:DG_GRID_RENDERER,gridLayer:GRID_LAYER,waypointLayer:WP_AUTO_LAYER,
    cells:GRID_CELLS,selection:SELECTED_CELLS,
    rendererCleared:()=>{DG_GRID_RENDERER=null;},
    gridCleared:()=>{GRID_LAYER=null;},waypointsCleared:()=>{WP_AUTO_LAYER=null;},
    getSummary:()=>$("gridSummary"),getGridControl:()=>$("togGrid"),getWaypointControl:()=>$("togWp")
  });
}

function toggleGridVis(){
  if(!GRID_LAYER)return;
  return window.DG_MAP_LAYER_VISIBILITY_UI.toggle({map,layer:GRID_LAYER,control:$("togGrid")});
}
function toggleWpVis(){
  if(!WP_AUTO_LAYER)return;
  return window.DG_MAP_LAYER_VISIBILITY_UI.toggle({map,layer:WP_AUTO_LAYER,control:$("togWp")});
}

/* =========================================================
   WAYPOINT
========================================================= */

const DG_GRID_WAYPOINT_CREATE=window.DG_GRID_WAYPOINT_CREATE_APPLICATION.create({
  confirmBatch:count=>confirm(count+" waypoint?\nDevam?"),
  fetchLatest:pid=>window.DG_GRID_WAYPOINT_STORE.fetchLatest(sb,pid),
  isCurrent:({source,park,projectId})=>window.DG_GRID_WAYPOINT_CONTEXT.isCurrent({
    source,park,projectId,getReviewSignature:dgGridReviewSignature,
    getGridSource:()=>DG_GRID_SOURCE,getPark:()=>PARK_POLY,
    getProjectId:()=>+$("gridProject").value
  }),
  getUserId:()=>USER.id,
  prepareBatch:(cells,latest,userId,pid)=>window.DG_GRID_WAYPOINT_BATCH.prepare(cells,latest,userId,pid,window.DG_GRID_WAYPOINT_ROWS.build),
  setLastRows:rows=>{LAST_WP_ROWS=rows;},
  insert:rows=>window.DG_GRID_WAYPOINT_INSERT.insert(sb,rows)
});

async function createWaypointsFromGrid(mode){
  const source=DG_GRID_SOURCE,park=PARK_POLY;
  const readiness=window.DG_GRID_WAYPOINT_READINESS.resolve({
    cells:GRID_CELLS,
    mode,
    selectedCells:SELECTED_CELLS,
    source,
    getCurrentSource:dgGridReviewSignature,
    getProjectId:()=>+$("gridProject").value||0,
    select:window.DG_GRID_WAYPOINT_SELECTION.select
  });

  if(!readiness.ok){
    if(readiness.reason==="surface-stale")return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");
    const messages={
      "grid-missing":"Önce grid oluştur",
      "project-missing":"Önce proje seç",
      "manual-selection-missing":"Önce hücre seçin",
      "target-cells-missing":"Uygun hücre yok"
    };
    return toast(messages[readiness.reason]);
  }

  const pid=readiness.projectId;
  const result=await DG_GRID_WAYPOINT_CREATE({source,park,projectId:pid,targetCells:readiness.targetCells});
  if(result.status==="cancelled")return;
  if(result.status==="stale")return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");
  if(result.status==="write-failed")return toast("Hata: "+result.error.message,"err");
  return window.DG_GRID_WAYPOINT_COMPLETION_UI.complete({
    result,projectId:pid,
    renderLayer:rows=>window.DG_GRID_WAYPOINT_LAYER.render({map,previousLayer:WP_AUTO_LAYER,rows,leaflet:L}),
    setLayer:layer=>{WP_AUTO_LAYER=layer;},getProjectControl:()=>$("nProject"),
    loadWaypoints,notify:toast,clearSelection:clearCellSelection
  });
}
