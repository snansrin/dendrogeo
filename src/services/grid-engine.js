"use strict";
/* DendroGeo · services/grid-engine.js — ÖRNEKLEM IZGARASI MOTORU (Faz 4)
 * gridplan.js'ten birebir taşındı: buildGrid (hücre üretimi + engel
 * tamponları), çizim/özet, hücre seçimi, görünürlük anahtarları ve
 * ızgaradan waypoint üretimi.
 * Bağımlılıklar (çağrı anında global): park-state.*, park-geometry.*,
 * leaflet L, $, esc, toast. */

/* =========================================================
   GRID
========================================================= */

async function buildGrid(){
  if(
    !PARK_POLY||
    !PARK_POLY.length
  ){
    return toast(
      "Önce park seç"
    );
  }

  const size=
    +$("gridSize").value||
    20;

  const est=
    Math.round(
      parkAreaM2()/
      (size*size)
    );

  if(est>3000){
    return toast(
      "⚠ ~"+
      est+
      " hücre çok yoğun.",
      "err"
    );
  }

  if(
    est>800 &&
    !confirm(
      `⚠ ~${est} hücre.\nDevam?`
    )
  ){
    return;
  }

  clearGrid();

  let minLat=90;
  let maxLat=-90;
  let minLon=180;
  let maxLon=-180;

  PARK_POLY.forEach(r=>
    r.forEach(p=>{
      if(p[0]<minLat)minLat=p[0];
      if(p[0]>maxLat)maxLat=p[0];

      if(p[1]<minLon)minLon=p[1];
      if(p[1]>maxLon)maxLon=p[1];
    })
  );

  const lat0=
    (
      (minLat+maxLat)/2
    )*
    Math.PI/180;

  const dLat=
    size/110540;

  const dLon=
    size/
    (
      111320*
      Math.max(
        .1,
        Math.cos(lat0)
      )
    );

  const cellMap={};

  GRID_CELLS.length=0;

  for(let rI=0;;rI++){
    const s0=
      minLat+
      rI*dLat;

    const s1=
      s0+dLat;

    if(s0>=maxLat)break;

    for(let cI=0;;cI++){
      const w0=
        minLon+
        cI*dLon;

      const w1=
        w0+dLon;

      if(w0>=maxLon)break;

      if(
        !isCellValid(
          s0,
          s1,
          w0,
          w1
        )
      ){
        continue;
      }

      const cell={
        lat:(s0+s1)/2,
        lon:(w0+w1)/2,
        s0,
        s1,
        w0,
        w1,
        n:0,
        id:rI+"_"+cI
      };

      cellMap[cell.id]=cell;

      GRID_CELLS.push(cell);
    }
  }

  const{data,count}=await sb
    .from("measurements")
    .select("lat,lon",{count:"exact"})
    .eq("status","Onaylı")
    .gte("lat",minLat)
    .lte("lat",maxLat)
    .gte("lon",minLon)
    .lte("lon",maxLon)
    .limit(5000);

  /* Bu sorgu zaten bbox ile sınırlı (doğru yaklaşım) ama 5000 üst sınırı var.
   * Yoğun bir bölgede eşik aşılırsa hücre başına düşen ölçüm sayısı eksik
   * kalır ve ızgara yoğunluk hesabı sessizce bozulur. */
  dgWarnIfTruncated(data,5000,"Izgara ölçüm yoğunluğu",count);

  (data||[]).forEach(m=>{
    const cell=
      cellMap[
        Math.floor(
          (m.lat-minLat)/
          dLat
        )+
        "_" +
        Math.floor(
          (m.lon-minLon)/
          dLon
        )
      ];

    if(cell){
      cell.n++;
    }
  });

  SELECTED_CELLS.clear();

  drawGridLayer();

  toast(
    "✓ Grid hazır: "+
    GRID_CELLS.length+
    " hücre",
    "ok",
    "🔲"
  );
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

  GRID_LAYER=
    L.layerGroup().addTo(map);

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

    const rect=
      L.rectangle(
        [
          [cell.s0,cell.w0],
          [cell.s1,cell.w1]
        ],
        {
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
      `Hücre ${cell.id} · ${cell.n} ölçüm`,
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

    `Toplam: <b>${tot}</b> · `+
    `🟢 Ölçülmüş: ${g} (%${pct(g)}) · `+
    `🔴 Boş: ${r0} (%${pct(r0)})<br>`+

    (
      selCount>0
        ?
        `<b style="color:#1d4ed8">🔵 Seçili: ${selCount}</b><br>`
        :
        ""
    )+

    `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+

    (
      r0>0
        ?
        `<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">📍 Otomatik (${r0})</button>`
        :
        ""
    )+

    (
      selCount>0
        ?
        `<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">📍 Seçili (${selCount})</button>`
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

    `</div>`;
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
  if(!GRID_CELLS.length){
    return toast(
      "Önce grid oluştur"
    );
  }

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

  let next=
    (
      mx&&
      mx.length
        ?mx[0].wp_id
        :0
    )+1;

  const first=next;

  const rows=
    targetCells.map(c=>({
      owner:USER.id,
      project_id:pid,
      wp_id:next++,
      /* ⚠ WAYPOINT HATASI BURADAYDI: GRID_CELLS elemanlarında lat/lon
       * alanı YOK (yalnız s0,s1,w0,w1,n,id) → c.lat.toFixed TypeError
       * fırlatıyor, insert hiç çalışmıyordu. Merkez açıkça hesaplanır. */
      lat:+(((c.s0+c.s1)/2).toFixed(6)),
      lon:+(((c.w0+c.w1)/2).toFixed(6)),
      visited:false
    }));

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
