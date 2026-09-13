"use strict";
/* ===== DendroGeo v2 · src/services/gridplan.js v8 =====
Park sınırı + grid planlama + su/katı zemin filtresi
+ RBush spatial index + MANUEL SEÇİM (FİLTRE MUAF) */

import RBush from 'https://cdn.jsdelivr.net/npm/rbush/+esm';

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false,PARK_CANDS=[];
let WATER_RINGS=[],WATER_LAYER=null;
let IMP_NODES=[],IMP_LAYER=null;
const GRID_CELLS=[];
let GRID_LAYER=null,WP_AUTO_LAYER=null;
const SELECTED_CELLS=new Set();

// RBush spatial index (su ve bina için)
let WATER_TREE=null, IMP_TREE=null;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass.osm.ch/api/interpreter"
];

// === RBUSH SPATIAL INDEX ===
function buildRBush(points){
 const tree=new RBush();
 const items=points.map((p,i)=>({
  minX:p[1],minY:p[0],maxX:p[1],maxY:p[0],idx:i,lat:p[0],lon:p[1]
 }));
 tree.load(items);
 return tree;
}

function queryRBush(tree,lat,lon,bufferDeg){
 if(!tree)return [];
 const r=tree.search({
  minX:lon-bufferDeg,minY:lat-bufferDeg,
  maxX:lon+bufferDeg,maxY:lat+bufferDeg
 });
 return r;
}

// === OVERPASS SORGUSU ===
async function queryPark(lat,lon,radius=1200){
 const q=`[out:json][timeout:20];(way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:${radius},${lat},${lon});way["landuse"~"forest|grass|meadow|recreation_ground"](around:${radius},${lat},${lon});relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});way["natural"="water"](around:${radius},${lat},${lon});way["waterway"~"riverbank|canal|dock|basin"](around:${radius},${lat},${lon});relation["natural"="water"](around:${radius},${lat},${lon});way["building"](around:${radius},${lat},${lon});way["highway"~"residential|primary|secondary|tertiary|service|footway|path|cycleway|track|unclassified"](around:${radius},${lat},${lon});way["landuse"~"commercial|industrial|retail|construction"](around:${radius},${lat},${lon}););out geom;`;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   const cands=[];WATER_RINGS=[];IMP_NODES=[];
   for(const el of (json.elements||[])){
    if(isWater(el)){const r=extractRings(el);if(r)WATER_RINGS=WATER_RINGS.concat(r);continue;}
    if(isImpervious(el)){collectImpNodes(el);continue;}
    const rings=extractRings(el);
    if(!rings||!rings.length)continue;
    cands.push({rings,name:(el.tags&&el.tags.name)||null,area:polyArea(rings)});
   }
   if(!cands.length)continue;
   const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
   // RBush index oluştur
   WATER_TREE=buildRBush(WATER_RINGS.flat());
   IMP_TREE=buildRBush(IMP_NODES);
   return (inside.length?inside:cands).slice().sort((a,b)=>b.area-a.area);
  }catch(e){}
 }
 return null;
}

function extractRings(el){
 if(el.type==="way"&&el.geometry){
  const r=el.geometry.map(g=>[g.lat,g.lon]);
  return r.length>2?[r]:null;
 }
 if(el.type==="relation"&&el.members){
  const outer=el.members.filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry.map(g=>[g.lat,g.lon]));
  if(!outer.length)return null;
  return joinWaysToRings(outer);
 }
 return null;
}

function isWater(el){
 const t=el.tags||{};
 return t.natural==="water"||t.landuse==="reservoir"||t.landuse==="basin"||t.leisure==="swimming_pool"||!!t.waterway;
}

function isImpervious(el){
 const t=el.tags||{};
 return !!t.building||!!t.highway||t.landuse==="commercial"||t.landuse==="industrial"||t.landuse==="retail"||t.landuse==="construction";
}

function collectImpNodes(el){
 if(el.type==="way"&&el.geometry){
  el.geometry.forEach(g=>IMP_NODES.push([g.lat,g.lon]));
 }else if(el.type==="relation"&&el.members){
  el.members.filter(m=>m.geometry).forEach(m=>{
   m.geometry.forEach(g=>IMP_NODES.push([g.lat,g.lon]));
  });
 }
}

function pointInWater(lat,lon){
 return WATER_RINGS.some(r=>pointInPolygon(lat,lon,r));
}

// RBush ile hızlı su/bina kontrolü
function nearWater(lat,lon){
 const b2=0.000135*0.000135; // ~15m
 const pts=queryRBush(WATER_TREE,lat,lon,0.0002);
 for(const p of pts){
  const dx=p.lon-lon,dy=p.lat-lat;
  if(dx*dx+dy*dy<b2)return true;
 }
 return false;
}

function nearImpervious(lat,lon){
 const b2=0.00009*0.00009; // ~10m
 const pts=queryRBush(IMP_TREE,lat,lon,0.0002);
 for(const p of pts){
  const dx=p.lon-lon,dy=p.lat-lat;
  if(dx*dx+dy*dy<b2)return true;
 }
 return false;
}

function isValidSpot(lat,lon){
 if(pointInWater(lat,lon))return false;
 if(nearWater(lat,lon))return false;
 if(nearImpervious(lat,lon))return false;
 return true;
}

// HÜCRE GEÇERLİ Mİ? — Merkez + 4 köşe (kenar ortası YOK)
function isCellValid(s0,s1,w0,w1){
 const cLat=(s0+s1)/2, cLon=(w0+w1)/2;
 // Park içinde mi?
 if(!pointInPark(cLat,cLon,PARK_POLY))return false;
 // Merkez + 4 köşe su/yol/bina değil mi?
 if(!isValidSpot(cLat,cLon))return false;
 if(!isValidSpot(s0,w0))return false;
 if(!isValidSpot(s0,w1))return false;
 if(!isValidSpot(s1,w0))return false;
 if(!isValidSpot(s1,w1))return false;
 return true;
}

// ... (joinWaysToRings, pointInPolygon, pointInPark, polyArea aynı kalıyor)

function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi Modu: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?"Şimdi haritada bir parkın İÇİNE tıkla.":"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
 bindParkClick();
 if(!PARK_MODE){PARK_CANDS=[];clearPark();}
}

function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sınırı sorgulanıyor…","info");
  const parks=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!parks||!parks.length)return toast("Park bulunamadı veya Overpass yoğun. 10 sn sonra tekrar dene.","warn");
  PARK_CANDS=parks;
  drawPark(parks[0]);
 });
}

function drawPark(park){
 clearPark();clearGrid();
 PARK_POLY=park.rings;
 PARK_LAYER=L.polygon(park.rings,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);
 if(WATER_RINGS.length)WATER_LAYER=L.polygon(WATER_RINGS,{color:"#2563eb",weight:1,fillColor:"#60a5fa",fillOpacity:.4,interactive:false}).addTo(map);
 if(IMP_NODES.length){
  IMP_LAYER=L.layerGroup().addTo(map);
  IMP_NODES.forEach(p=>L.circleMarker(p,{radius:1.5,color:"#9ca3af",fillColor:"#9ca3af",fillOpacity:.5,weight:0,interactive:false}).addTo(IMP_LAYER));
 }
 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});
 
 const totalArea=park.area/10000;
 const waterArea=WATER_RINGS.length?polyArea(WATER_RINGS):0;
 const landArea=Math.max(0,park.area-waterArea);
 const haLand=(landArea/10000).toFixed(1);
 const haWater=(waterArea/10000).toFixed(1);
 
 // UYARI: Park çok büyükse manuel waypoint öner
 let sizeWarn="";
 if(totalArea>50){
  sizeWarn=`<div style="margin-top:8px;padding:10px;background:#fef3c7;border-radius:8px;font-size:.78rem;color:#92400e;border-left:3px solid #f59e0b">⚠️ <b>Bu alan çok geniş (${totalArea.toFixed(1)} ha).</b> Grid oluşturmak yerine manuel waypoint kullanmanız önerilir. Grid sadece küçük alanlar için uygundur.</div>`;
 }
 
 const alt=PARK_CANDS.length>1
  ?`<div style="margin-top:8px;font-size:.8rem">🔁 Alan seç: <select id="parkAlt" onchange="switchPark(+this.value)">`+
   PARK_CANDS.map((c,i)=>`<option value="${i}"${c===park?" selected":""}>${esc(c.name||"İsimsiz")} · ${((c.area-waterArea)/10000).toFixed(1)} ha</option>`).join("")+
   `</select></div>`:"";
 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=`<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · <b>Kara: ${haLand} ha</b>${haWater>0.1?" · Su: "+haWater+" ha":""}${alt}${sizeWarn}`+
  `<div style="font-size:.75rem;color:var(--mut);margin-top:4px">🔒 Filtre: suya 15m + yol/binaya 10m (RBush spatial index)</div>`+
  `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+
  `<label style="font-size:.8rem">Proje:</label>`+
  `<select id="gridProject">`+((typeof PROJ_LIST!=="undefined"&&PROJ_LIST.length)?PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(""):`<option value="0">Önce proje oluştur</option>`)+`</select>`+
  `<label style="font-size:.8rem">Grid:</label>`+
  `<select id="gridSize"><option value="10">10×10 m</option><option value="20" selected>20×20 m</option><option value="50">50×50 m</option></select>`+
  `<label style="font-size:.8rem">Yeterli eşik:</label>`+
  `<select id="gridThresh"><option value="1">1+</option><option value="2">2+</option><option value="3" selected>3+</option><option value="5">5+</option></select></div>`+
  `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+
  `<button class="btn sm blue" onclick="buildGrid()">🔲 Grid Oluştur</button>`+
  `<button class="btn sm" id="gridVisBtn" onclick="toggleGridVis()">🔲 Grid: GÖRÜNÜR</button>`+
  `<button class="btn sm" id="wpVisBtn" onclick="toggleWpVis()">📍 Waypoint: GÖRÜNÜR</button>`+
  `<button class="btn sm" onclick="clearGrid()">✕ Temizle</button></div>`+
  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;
 toast("✓ Park algılandı: "+haLand+" ha kara"+(haWater>0.1?" + "+haWater+" ha su":""),"ok","🌳");
}

function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 if(WATER_LAYER&&map){map.removeLayer(WATER_LAYER);WATER_LAYER=null;}
 if(IMP_LAYER&&map){map.removeLayer(IMP_LAYER);IMP_LAYER=null;}
 WATER_RINGS=[];IMP_NODES=[];PARK_POLY=null;
 WATER_TREE=null;IMP_TREE=null;
 const pi=$("parkInfo");if(pi){pi.style.display="none";pi.innerHTML="";}
}

function switchPark(i){const p=PARK_CANDS[i];if(p)drawPark(p);}

async function buildGrid(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const size=+$("gridSize").value||20;
 const thresh=+$("gridThresh").value||3;
 const est=Math.round(polyArea(PARK_POLY)/(size*size));
 if(est>3000)return toast("⚠ ~"+est+" hücre çok yoğun. 50×50 m seç.","err");
 if(est>800&&!confirm(`⚠ ~${est} hücre oluşturulacak.\nDevam?`))return;
 clearGrid();
 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const lat0=minLat*Math.PI/180;
 const dLat=size/110540,dLon=size/(111320*Math.cos(lat0));
 const cellMap={};GRID_CELLS.length=0;
 
 for(let rI=0;;rI++){
  const s0=minLat+rI*dLat,s1=s0+dLat;
  if(s0>=maxLat)break;
  for(let cI=0;;cI++){
   const w0=minLon+cI*dLon,w1=w0+dLon;
   if(w0>=maxLon)break;
   const cLat=s0+dLat/2,cLon=w0+dLon/2;
   
   // SADECE PARK İÇİ + SU/YOL/BİNA DEĞİL
   if(!isCellValid(s0,s1,w0,w1))continue;
   
   const cell={lat:cLat,lon:cLon,s0,s1,w0,w1,n:0,id:rI+"_"+cI};
   cellMap[cell.id]=cell;GRID_CELLS.push(cell);
  }
 }
 
 const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı")
  .gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
 (data||[]).forEach(m=>{
  const cell=cellMap[Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon)];
  if(cell)cell.n++;
 });
 
 SELECTED_CELLS.clear();
 drawGridLayer();
 toast("✓ Grid hazır: "+GRID_CELLS.length+" hücre","ok","🔲");
}

function drawGridLayer(){
 if(GRID_LAYER&&map)map.removeLayer(GRID_LAYER);
 GRID_LAYER=L.layerGroup().addTo(map);
 const thresh=+$("gridThresh")?.value||3;
 let g=0,y=0,r0=0;
 
 GRID_CELLS.forEach(cell=>{
  const col=cell.n===0?"#e11d48":cell.n<thresh?"#f59e0b":"#16a34a";
  if(cell.n===0)r0++;else if(cell.n<thresh)y++;else g++;
  const isSel=SELECTED_CELLS.has(cell.id);
  
  const rect=L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{
   color:isSel?"#1d4ed8":col,
   weight:isSel?3:1.2,
   fillColor:isSel?"#3b82f6":col,
   fillOpacity:isSel?.55:.32,
   interactive:true
  }).addTo(GRID_LAYER);
  
  rect._cellId=cell.id;
  rect.on("click",(e)=>{
   L.DomEvent.stopPropagation(e);
   toggleCellSelection(cell.id,rect);
  });
  rect.bindTooltip(`Hücre ${cell.id} · ${cell.n} ölçüm · Tıkla: seç/kaldır`,{sticky:true});
 });
 
 updateGridSummary(g,y,r0);
}

function updateGridSummary(g,y,r0){
 const thresh=+$("gridThresh")?.value||3;
 const tot=GRID_CELLS.length,pct=v=>tot?Math.round(v/tot*100):0;
 const selCount=SELECTED_CELLS.size;
 $("gridSummary").innerHTML=
  `<b>📊 Park Analizi</b> · Grid ${$("gridSize")?.value||20}×${$("gridSize")?.value||20} m<br>`+
  `Toplam hücre: <b>${tot}</b><br>`+
  `<span style="color:#16a34a">🟢 Yeterli (${thresh}+): ${g} (%${pct(g)})</span> · `+
  `<span style="color:#b45309">🟡 Az: ${y} (%${pct(y)})</span> · `+
  `<span style="color:#e11d48">🔴 Boş: ${r0} (%${pct(r0)})</span><br>`+
  (selCount>0?`<b style="color:#1d4ed8">🔵 Seçili: ${selCount} hücre</b><br>`:"")+
  `💡 Hücrelere tıklayarak manuel seçim yapabilirsiniz.<br>`+
  `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+
  (r0>0?`<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">📍 Otomatik (${r0} boş)</button>`:"")+
  (selCount>0?`<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">📍 Seçili (${selCount})</button>`:"")+
  (selCount>0?`<button class="btn sm ghost" onclick="clearCellSelection()">✕ Seçimi Temizle</button>`:"")+
  `</div>`;
}

function toggleCellSelection(cellId, rect){
 if(SELECTED_CELLS.has(cellId)){
  SELECTED_CELLS.delete(cellId);
  const cell=GRID_CELLS.find(c=>c.id===cellId);
  if(cell){
   const thresh=+$("gridThresh")?.value||3;
   const col=cell.n===0?"#e11d48":cell.n<thresh?"#f59e0b":"#16a34a";
   rect.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});
  }
 }else{
  SELECTED_CELLS.add(cellId);
  rect.setStyle({color:"#1d4ed8",weight:3,fillColor:"#3b82f6",fillOpacity:.55});
 }
 let g=0,y=0,r0=0;
 const thresh=+$("gridThresh")?.value||3;
 GRID_CELLS.forEach(c=>{if(c.n===0)r0++;else if(c.n<thresh)y++;else g++;});
 updateGridSummary(g,y,r0);
}

function clearCellSelection(){
 SELECTED_CELLS.clear();
 if(GRID_LAYER){
  const thresh=+$("gridThresh")?.value||3;
  GRID_LAYER.eachLayer(l=>{
   if(l.setStyle&&l._cellId){
    const cell=GRID_CELLS.find(c=>c.id===l._cellId);
    if(cell){
     const col=cell.n===0?"#e11d48":cell.n<thresh?"#f59e0b":"#16a34a";
     l.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});
    }
   }
  });
 }
 let g=0,y=0,r0=0;
 const thresh=+$("gridThresh")?.value||3;
 GRID_CELLS.forEach(c=>{if(c.n===0)r0++;else if(c.n<thresh)y++;else g++;});
 updateGridSummary(g,y,r0);
}

function clearGrid(){
 if(GRID_LAYER&&map){map.removeLayer(GRID_LAYER);GRID_LAYER=null;}
 if(WP_AUTO_LAYER&&map){map.removeLayer(WP_AUTO_LAYER);WP_AUTO_LAYER=null;}
 GRID_CELLS.length=0;SELECTED_CELLS.clear();
 const gs=$("gridSummary");if(gs)gs.innerHTML="";
}

function toggleGridVis(){
 if(!GRID_LAYER)return;
 if(map.hasLayer(GRID_LAYER)){map.removeLayer(GRID_LAYER);$("gridVisBtn").textContent="🔲 Grid: GİZLİ";}
 else{map.addLayer(GRID_LAYER);$("gridVisBtn").textContent="🔲 Grid: GÖRÜNÜR";}
}
function toggleWpVis(){
 if(!WP_AUTO_LAYER)return;
 if(map.hasLayer(WP_AUTO_LAYER)){map.removeLayer(WP_AUTO_LAYER);$("wpVisBtn").textContent="📍 Waypoint: GİZLİ";}
 else{map.addLayer(WP_AUTO_LAYER);$("wpVisBtn").textContent="📍 Waypoint: GÖRÜNÜR";}
}

async function createWaypointsFromGrid(mode){
 if(!GRID_CELLS.length)return toast("Önce grid oluştur","warn");
 const pid=+$("gridProject").value||0;
 if(!pid)return toast("Önce proje seç veya oluştur","warn");
 
 let targetCells=[];
 if(mode==="manual"){
  if(!SELECTED_CELLS.size)return toast("Önce hücre seçin","warn");
  // MANUEL SEÇİMDE FİLTRE YOK — kullanıcı bilinçli seçti
  targetCells=GRID_CELLS.filter(c=>SELECTED_CELLS.has(c.id));
 }else{
  // OTOMATİK MODDA FİLTRE VAR — sadece boş ve geçerli hücreler
  targetCells=GRID_CELLS.filter(c=>c.n===0);
 }
 
 if(!targetCells.length)return toast("Uygun hücre yok","warn");
 if(targetCells.length>500&&!confirm(targetCells.length+" waypoint oluşturulacak.\nDevam?"))return;
 
 const{data:mx}=await sb.from("waypoints").select("wp_id").eq("project_id",pid).order("wp_id",{ascending:false}).limit(1);
 let next=(mx&&mx.length?mx[0].wp_id:0)+1;
 const first=next;
 const rows=targetCells.map(c=>({owner:USER.id,project_id:pid,wp_id:next++,lat:+c.lat.toFixed(6),lon:+c.lon.toFixed(6),visited:false}));
 const{error}=await sb.from("waypoints").insert(rows);
 if(error)return toast("Hata: "+error.message,"err");
 if(WP_AUTO_LAYER&&map)map.removeLayer(WP_AUTO_LAYER);
 WP_AUTO_LAYER=L.layerGroup().addTo(map);
 rows.forEach(r=>L.circleMarker([r.lat,r.lon],{radius:5,color:"#fff",weight:1.5,fillColor:"#e11d48",fillOpacity:.95,interactive:false}).addTo(WP_AUTO_LAYER));
 $("nProject").value=String(pid);
 loadWaypoints();
 toast("✓ "+rows.length+" waypoint oluşturuldu (P"+first+"–P"+(next-1)+")","ok","📍");
 clearCellSelection();
}
