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

let DG_GRID_BUSY=false,DG_GRID_EPOCH=0,DG_GRID_RENDERER=null,DG_GRID_SOURCE=null,DG_GRID_META="";
function dgGridReviewSignature(){return window.DG_GRID_REVIEW_SIGNATURE.resolve(window.DG_LC_SENS?.state);}
async function buildGrid(){
 if(DG_GRID_BUSY)return;
 if(!PARK_POLY?.length)return toast("Önce park seç","warn");
 const {size,clearance}=window.DG_GRID_OPTIONS.resolve($("gridSize")?.value,$("gridClearance")?.value);
 const park=PARK_POLY,epoch=++DG_GRID_EPOCH,btn=$("gridBuildBtn");DG_GRID_BUSY=true;
 if(btn){btn.disabled=true;btn.textContent="⏳ Grid hazırlanıyor…";}
 try{
  if(typeof dgEnsureLulc==="function")await dgEnsureLulc();
  if(epoch!==DG_GRID_EPOCH||park!==PARK_POLY)return;
  if(DG_GREEN_ONLY&&!(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST?.result?.cells?.length))throw Error("Önce yüzey analizi yapın; grid güncel yeşil alanı kullanır.");
  const review=window.DG_LC_SENS?.state;if(review?.busy||review?.saving)throw Error("Yüzey işleminin tamamlanmasını bekleyin.");
  const signature=dgGridReviewSignature(),epsg=dgLcUtmEpsgForLatLon(park[0][0][0],park[0][0][1]);
  const lastCells=typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.result?.cells:null;
  const osmElements=window.DG_SURFACE_OSM?.boundary===JSON.stringify(park)?window.DG_SURFACE_OSM.elements:[];
  const parts=await window.DG_GRID_SURFACE_PARTS.prepare({
   review,
   lastCells,
   outer:park,
   holes:PARK_HOLES||[],
   epsg,
   osmElements,
   resolveReviewParts:()=>window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,review.geometry,dgSensFeatures(),review.epsg,review.parkGeometry),
   prepare:dgSurfacePrepare
  });
  const request=window.DG_GRID_REQUEST.build({size,clearance,epsg,outer:park,holes:PARK_HOLES,greenOnly:DG_GREEN_ONLY,parts,waterRings:WATER_RINGS,imperviousRings:IMP_RINGS,waterLines:WATER_LINES,imperviousLines:IMP_LINES,gridBlockLines:GRID_BLOCK_LINES});
  const result=await dgSurfaceWorkerJob(request)||await dgSurfaceGrid(request);
  if(epoch!==DG_GRID_EPOCH||park!==PARK_POLY)return;
  if(signature!==dgGridReviewSignature())throw Error("Yüzey değişti. Güncel yüzeyle gridi tekrar oluşturun.");
  const bounds=window.DG_GRID_BOUNDS.resolve(park);
  const {data,count,error}=await window.DG_GRID_MEASUREMENT_STORE.fetchCandidates(sb,bounds);
  if(error)throw error;if(epoch!==DG_GRID_EPOCH||park!==PARK_POLY)return;
  dgWarnIfTruncated(data,5000,"Izgara ölçüm yoğunluğu",count);
  window.DG_GRID_CELL_MEASUREMENTS.count(result.cells,data,{size,epsg,x0:result.x0,y0:result.y0,project:dgLcUtmForward,pointDistance:dgGridPointDistance,featureGeometry:dgSurfaceFeatureGeometry});
  if(signature!==dgGridReviewSignature())throw Error("Yüzey değişti. Güncel yüzeyle gridi tekrar oluşturun.");
  clearGrid();DG_GRID_SOURCE=signature;DG_GRID_META=`<p class="measure-help">${_tgr("Su ve sert zeminden uzaklık")}: ${clearance} m · ${_tgr(review?.editing?"Yüzey önizlemesi":"Kayıtlı yüzey")} · ${(result.areaM2/10000).toFixed(3)} ha ${_tgr("uygun alan")}</p>`;GRID_CELLS.push(...result.cells);drawGridLayer();
  toast(_tgrf("✓ Grid hazır: {n} hücre",{n:GRID_CELLS.length}),GRID_CELLS.length?"ok":"warn","🔲");
 }catch(e){toast(String(e.message||e),"err","🔲");}
 finally{DG_GRID_BUSY=false;if(btn?.isConnected){btn.disabled=false;btn.textContent="🔲 Grid Oluştur";}}
}

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

  const targetCells=readiness.targetCells;
  const pid=readiness.projectId;
  if(
    targetCells.length>500 &&
    !confirm(
      targetCells.length+
      " waypoint?\nDevam?"
    )
  ){
    return;
  }

  const{data:mx}=await window.DG_GRID_WAYPOINT_STORE.fetchLatest(sb,pid);

  if(!window.DG_GRID_WAYPOINT_CONTEXT.isCurrent({
    source,
    park,
    projectId:pid,
    getReviewSignature:dgGridReviewSignature,
    getGridSource:()=>DG_GRID_SOURCE,
    getPark:()=>PARK_POLY,
    getProjectId:()=>+$("gridProject").value
  }))return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");

  const batch=window.DG_GRID_WAYPOINT_BATCH.prepare(
    targetCells,
    mx,
    USER.id,
    pid,
    window.DG_GRID_WAYPOINT_ROWS.build
  );
  const first=batch.firstWpId;
  const rows=batch.rows;
  const next=first+rows.length;

  LAST_WP_ROWS=rows;

  const{error}=await window.DG_GRID_WAYPOINT_INSERT.insert(sb,rows);

  if(error){
    return toast(
      "Hata: "+
      error.message,
      "err"
    );
  }

  WP_AUTO_LAYER=window.DG_GRID_WAYPOINT_LAYER.render({
    map,
    previousLayer:WP_AUTO_LAYER,
    rows,
    leaflet:L
  });

  $("nProject").value=
    String(pid);

  loadWaypoints();

  toast(
    "✓ "+
    rows.length+
    " waypoint (P"+
    first+"–P"+
    (next-1)+
    ")",
    "ok",
    "📍"
  );

  clearCellSelection();
}
