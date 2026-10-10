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
function dgGridReviewSignature(){const s=window.DG_LC_SENS?.state;return s?.record?JSON.stringify([s.epoch,s.partitionVersion,s.record.scannedAt,s.editing,s.record.sens,s.record.corrections,s.record.features,s.record.useObjects]):null;}
async function buildGrid(){
 if(DG_GRID_BUSY)return;
 if(!PARK_POLY?.length)return toast("Önce park seç","warn");
 const size=Number($("gridSize")?.value)||20,clearance=Math.max(1,Math.min(20,Number($("gridClearance")?.value)||3));
 const park=PARK_POLY,epoch=++DG_GRID_EPOCH,btn=$("gridBuildBtn");DG_GRID_BUSY=true;
 if(btn){btn.disabled=true;btn.textContent="⏳ Grid hazırlanıyor…";}
 try{
  if(typeof dgEnsureLulc==="function")await dgEnsureLulc();
  if(epoch!==DG_GRID_EPOCH||park!==PARK_POLY)return;
  if(DG_GREEN_ONLY&&!(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST?.result?.cells?.length))throw Error("Önce yüzey analizi yapın; grid güncel yeşil alanı kullanır.");
  const review=window.DG_LC_SENS?.state;if(review?.busy||review?.saving)throw Error("Yüzey işleminin tamamlanmasını bekleyin.");
  const signature=dgGridReviewSignature(),epsg=dgLcUtmEpsgForLatLon(park[0][0][0],park[0][0][1]);
  let parts=[];
  if(review?.record&&review.geometry)parts=window.DG_SURFACE_REVIEW.resolved(dgSensCells(),dgSensEffective,review.geometry,dgSensFeatures(),review.epsg,review.parkGeometry);
  else if(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST?.result?.cells?.length){
   const cells=DG_LC_LAST.result.cells,prepared=await dgSurfacePrepare({cells,outer:park,holes:PARK_HOLES||[],epsg,objects:null,elements:window.DG_SURFACE_OSM?.boundary===JSON.stringify(park)?window.DG_SURFACE_OSM.elements:[],features:[]});
   parts=prepared.parts;
  }
  const request={job:"grid",size,clearance,epsg,outer:park,holes:PARK_HOLES||[],greenOnly:DG_GREEN_ONLY,parts:parts.map(p=>({type:p.type,geom:p.geom})),blockRings:parts.length?[]:[...(WATER_RINGS||[]),...(IMP_RINGS||[])],blockLines:[...(WATER_LINES||[]).map(pts=>({pts,w:1})),...(IMP_LINES||[]),...(GRID_BLOCK_LINES||[])]};
  const result=await dgSurfaceWorkerJob(request)||await dgSurfaceGrid(request);
  if(epoch!==DG_GRID_EPOCH||park!==PARK_POLY)return;
  if(signature!==dgGridReviewSignature())throw Error("Yüzey değişti. Güncel yüzeyle gridi tekrar oluşturun.");
  const all=park.flat(),minLat=Math.min(...all.map(p=>p[0])),maxLat=Math.max(...all.map(p=>p[0])),minLon=Math.min(...all.map(p=>p[1])),maxLon=Math.max(...all.map(p=>p[1]));
  const {data,count,error}=await sb.from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
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

  let g=0;
  let r0=0;

  GRID_CELLS.forEach(cell=>{
    const col=
      cell.n===0
        ?"#e11d48"
        :"#16a34a";

    if(cell.n===0)r0++;
    else g++;

    const isSel=
      SELECTED_CELLS.has(
        cell.id
      );

    const shape=cell.geometry?cell.geometry.coordinates.map(poly=>poly.map(r=>r.map(p=>[p[1],p[0]]))):[[cell.s0,cell.w0],[cell.s0,cell.w1],[cell.s1,cell.w1],[cell.s1,cell.w0]];
    const rect=L.polygon(shape,
        {
          renderer:DG_GRID_RENDERER,
          color:
            isSel
              ?"#1d4ed8"
              :col,

          weight:
            isSel
              ?3
              :1.2,

          fillColor:
            isSel
              ?"#3b82f6"
              :col,

          fillOpacity:
            isSel
              ?.55
              :.32,

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
  const gs=$("gridSummary");
  if(gs)gs.style.display="block";

  const tot=
    GRID_CELLS.length;

  const pct=v=>
    tot
      ?Math.round(
        v/tot*100
      )
      :0;

  const selCount=
    SELECTED_CELLS.size;

  gs.innerHTML=

    `<b>📊 Grid</b> · `+
    `${$("gridSize")?.value||20}×${$("gridSize")?.value||20} m<br>`+

    `${_tgr("Toplam:")} <b>${tot}</b> · `+
    `🟢 ${_tgr("Ölçülmüş:")} ${g} (%${pct(g)}) · `+
    `🔴 ${_tgr("Boş:")} ${r0} (%${pct(r0)})<br>`+

    (
      selCount>0
        ?
        `<b style="color:#1d4ed8">🔵 ${_tgr("Seçili:")} ${selCount}</b><br>`
        :
        ""
    )+

    `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+

    (
      r0>0
        ?
        `<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">${_tgrf("📍 Otomatik ({n})",{n:r0})}</button>`
        :
        ""
    )+

    (
      selCount>0
        ?
        `<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">${_tgrf("📍 Seçili ({n})",{n:selCount})}</button>`
        :
        ""
    )+

    (
      selCount>0
        ?
        `<button class="btn sm ghost" onclick="clearCellSelection()">✕ Seçimi Temizle</button>`
        :
        ""
    )+

    `<button class="btn sm ghost" onclick="downloadGridGeoJSON()">📥 GeoJSON</button>`+

    `<button class="btn sm ghost" onclick="downloadWaypointsCSV()">📥 WP CSV</button>`+

    `</div>`+DG_GRID_META;
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
      const col=
        cell.n===0
          ?"#e11d48"
          :"#16a34a";

      rect.setStyle({
        color:col,
        weight:1.2,
        fillColor:col,
        fillOpacity:.32
      });
    }
  }else{
    SELECTED_CELLS.add(
      cellId
    );

    rect.setStyle({
      color:"#1d4ed8",
      weight:3,
      fillColor:"#3b82f6",
      fillOpacity:.55
    });
  }

  let g=0;
  let r0=0;

  GRID_CELLS.forEach(c=>{
    if(c.n===0)r0++;
    else g++;
  });

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
          const col=
            cell.n===0
              ?"#e11d48"
              :"#16a34a";

          l.setStyle({
            color:col,
            weight:1.2,
            fillColor:col,
            fillOpacity:.32
          });
        }
      }
    });
  }

  let g=0;
  let r0=0;

  GRID_CELLS.forEach(c=>{
    if(c.n===0)r0++;
    else g++;
  });

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
  if(!GRID_CELLS.length){
    return toast(
      "Önce grid oluştur"
    );
  }

  if(DG_GRID_SOURCE!==dgGridReviewSignature())return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");

  const pid=
    +$("gridProject").value||
    0;

  if(!pid){
    return toast(
      "Önce proje seç"
    );
  }

  let targetCells=
    mode==="manual"
      ?
      GRID_CELLS.filter(
        c=>SELECTED_CELLS.has(c.id)
      )
      :
      GRID_CELLS.filter(
        c=>c.n===0
      );

  if(
    mode==="manual" &&
    !SELECTED_CELLS.size
  ){
    return toast(
      "Önce hücre seçin"
    );
  }

  if(!targetCells.length){
    return toast(
      "Uygun hücre yok"
    );
  }

  if(
    targetCells.length>500 &&
    !confirm(
      targetCells.length+
      " waypoint?\nDevam?"
    )
  ){
    return;
  }

  const{data:mx}=await sb
    .from("waypoints")
    .select("wp_id")
    .eq("project_id",pid)
    .order(
      "wp_id",
      {
        ascending:false
      }
    )
    .limit(1);

  if(source!==dgGridReviewSignature()||source!==DG_GRID_SOURCE||park!==PARK_POLY||pid!==+$("gridProject").value)return toast(_tgr("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");

  let next=
    (
      mx&&
      mx.length
        ?mx[0].wp_id
        :0
    )+1;

  const first=next;

  const rows=window.DG_GRID_WAYPOINT_ROWS.build(targetCells,next,USER.id,pid);

  LAST_WP_ROWS=rows;

  const{error}=await sb
    .from("waypoints")
    .insert(rows);

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
