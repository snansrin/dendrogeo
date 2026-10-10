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
  if(
    GRID_LAYER &&
    map
  ){
    map.removeLayer(
      GRID_LAYER
    );
  }

  if(DG_GRID_RENDERER&&map)map.removeLayer(DG_GRID_RENDERER);
  GRID_LAYER=L.layerGroup().addTo(map);DG_GRID_RENDERER=L.canvas({padding:.1});

  const {measured:g,empty:r0}=window.DG_GRID_CELL_STATES.count(GRID_CELLS);

  GRID_CELLS.forEach(cell=>{
    const style=window.DG_GRID_CELL_STYLE.resolve(
      cell,
      SELECTED_CELLS.has(cell.id)
    );

    const shape=window.DG_GRID_CELL_SHAPE.resolve(cell);
    const rect=L.polygon(shape,
        {
          renderer:DG_GRID_RENDERER,
          ...style,
          interactive:true
        }
      ).addTo(
        GRID_LAYER
      );

    rect._cellId=
      cell.id;

    rect.on(
      "click",
      e=>{
        L.DomEvent.stopPropagation(
          e
        );

        toggleCellSelection(
          cell.id,
          rect
        );
      }
    );

    rect.bindTooltip(
      _tgrf("Hücre {id} · {n} ölçüm",{id:cell.id,n:cell.n}),
      {
        sticky:true
      }
    );
  });

  updateGridSummary(
    g,
    r0
  );
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

function toggleCellSelection(
  cellId,
  rect
){
  if(
    SELECTED_CELLS.has(
      cellId
    )
  ){
    SELECTED_CELLS.delete(
      cellId
    );

    const cell=
      GRID_CELLS.find(
        c=>c.id===cellId
      );

    if(cell){
      rect.setStyle(
        window.DG_GRID_CELL_STYLE.resolve(cell,false)
      );
    }
  }else{
    SELECTED_CELLS.add(
      cellId
    );

    const cell=GRID_CELLS.find(c=>c.id===cellId);
    if(cell)rect.setStyle(
      window.DG_GRID_CELL_STYLE.resolve(cell,true)
    );
  }

  const {measured:g,empty:r0}=window.DG_GRID_CELL_STATES.count(GRID_CELLS);
  updateGridSummary(
    g,
    r0
  );
}

function clearCellSelection(){
  SELECTED_CELLS.clear();

  if(GRID_LAYER){
    GRID_LAYER.eachLayer(l=>{
      if(
        l.setStyle &&
        l._cellId
      ){
        const cell=
          GRID_CELLS.find(
            c=>
              c.id===
              l._cellId
          );

        if(cell){
          l.setStyle(
            window.DG_GRID_CELL_STYLE.resolve(cell,false)
          );
        }
      }
    });
  }

  const {measured:g,empty:r0}=window.DG_GRID_CELL_STATES.count(GRID_CELLS);
  updateGridSummary(
    g,
    r0
  );
}

function clearGrid(){
  DG_GRID_META="";DG_GRID_SOURCE=null;
  ++DG_GRID_EPOCH;
  if(DG_GRID_RENDERER&&map)map.removeLayer(DG_GRID_RENDERER);DG_GRID_RENDERER=null;
  if(
    GRID_LAYER &&
    map
  ){
    map.removeLayer(
      GRID_LAYER
    );

    GRID_LAYER=null;
  }

  if(
    WP_AUTO_LAYER &&
    map
  ){
    map.removeLayer(
      WP_AUTO_LAYER
    );

    WP_AUTO_LAYER=null;
  }

  GRID_CELLS.length=0;

  SELECTED_CELLS.clear();

  const gs=
    $("gridSummary");

  if(gs){
    gs.innerHTML="";
    gs.style.display="none";
  }

  const togGrid=$("togGrid");
  if(togGrid)togGrid.checked=true;

  const togWp=$("togWp");
  if(togWp)togWp.checked=true;
}

function toggleGridVis(){
  if(!GRID_LAYER)return;

  const togEl=$("togGrid");

  if(map.hasLayer(GRID_LAYER)){
    map.removeLayer(GRID_LAYER);
    if(togEl)togEl.checked=false;
  }else{
    map.addLayer(GRID_LAYER);
    if(togEl)togEl.checked=true;
  }
}

function toggleWpVis(){
  if(!WP_AUTO_LAYER)return;

  const togEl=$("togWp");

  if(map.hasLayer(WP_AUTO_LAYER)){
    map.removeLayer(WP_AUTO_LAYER);
    if(togEl)togEl.checked=false;
  }else{
    map.addLayer(WP_AUTO_LAYER);
    if(togEl)togEl.checked=true;
  }
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

  if(source!==dgGridReviewSignature()||source!==DG_GRID_SOURCE||park!==PARK_POLY||pid!==+$("gridProject").value)return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");

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

  if(
    WP_AUTO_LAYER &&
    map
  ){
    map.removeLayer(
      WP_AUTO_LAYER
    );
  }

  WP_AUTO_LAYER=
    L.layerGroup().addTo(map);

  rows.forEach(r=>
    L.circleMarker(
      [
        r.lat,
        r.lon
      ],
      {
        radius:5,
        color:"#fff",
        weight:1.5,
        fillColor:"#e11d48",
        fillOpacity:.95,
        interactive:false
      }
    ).addTo(
      WP_AUTO_LAYER
    )
  );

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
