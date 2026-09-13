"use strict";
/* ===== gridplan.js v8 — BASİT VE KESİN ÇALIŞAN ===== */

let PARK_POLY=null,PARK_LAYER=null,PARK_MODE=false,PARK_CLICK_BOUND=false,PARK_CANDS=[];
let WATER_RINGS=[],WATER_LAYER=null;
let IMP_NODES=[],IMP_LAYER=null;
const GRID_CELLS=[];
let GRID_LAYER=null,WP_AUTO_LAYER=null;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass.osm.ch/api/interpreter"
];

// --- Park sorgusu ---
async function queryPark(lat,lon,radius=1200){
 const q=`[out:json][timeout:20];(way["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});way["natural"="water"](around:${radius},${lat},${lon});relation["natural"="water"](around:${radius},${lat},${lon});way["building"](around:${radius},${lat},${lon});way["highway"~"residential|primary|secondary|tertiary|service|footway|path|cycleway|track|unclassified"](around:${radius},${lat},${lon}););out geom;`;
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   const cands=[];WATER_RINGS=[];IMP_NODES=[];
   for(const el of (json.elements||[])){
    const t=el.tags||{};
    if(t.natural==="water"||t.waterway){
     const r=extractRings(el);if(r)WATER_RINGS=WATER_RINGS.concat(r);continue;
    }
    if(t.building||t.highway){
     collectImpNodes(el);continue;
    }
    const rings=extractRings(el);
    if(!rings||!rings.length)continue;
    cands.push({rings,name:t.name||null,area:polyArea(rings)});
   }
   if(!cands.length)continue;
   const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
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

function collectImpNodes(el){
 if(el.geometry)el.geometry.forEach(g=>IMP_NODES.push([g.lat,g.lon]));
}

// --- FİLTRE: BASİT VE KESİN (hız optimizasyonu yok, doğruluk var) ---
function pointInWater(lat,lon){
 return WATER_RINGS.some(r=>pointInPolygon(lat,lon,r));
}

function nearWater(lat,lon){
 const b2=0.0002*0.0002; // ~22m tampon
 for(const ring of WATER_RINGS){
  for(const p of ring){
   const dx=p[1]-lon,dy=p[0]-lat;
   if(dx*dx+dy*dy<b2)return true;
  }
 }
 return false;
}

function nearImpervious(lat,lon){
 const b2=0.00015*0.00015; // ~16m tampon
 for(const p of IMP_NODES){
  const dx=p[1]-lon,dy=p[0]-lat;
  if(dx*dx+dy*dy<b2)return true;
 }
 return false;
}

function isValidSpot(lat,lon){
 return !pointInWater(lat,lon)&&!nearWater(lat,lon)&&!nearImpervious(lat,lon);
}

// Hücrenin TAMAMI güvenli mi (merkez + 4 köşe)
function isCellValid(s0,s1,w0,w1){
 const cLat=(s0+s1)/2,cLon=(w0+w1)/2;
 if(!pointInPark(cLat,cLon,PARK_POLY))return false;
 return isValidSpot(cLat,cLon)&&isValidSpot(s0,w0)&&isValidSpot(s0,w1)&&isValidSpot(s1,w0)&&isValidSpot(s1,w1);
}

// --- Geometri ---
function joinWaysToRings(ways){
 const rings=[],rem=ways.slice();
 const eq=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
 while(rem.length){
  const ch=rem.shift().slice();let m=true,g=ways.length*2+10;
  while(m&&g-->0){m=false;for(let i=0;i<rem.length;i++){
   const w=rem[i],h=ch[0],t=ch[ch.length-1];
   if(eq(t,w[0])){ch.push(...w.slice(1));m=true;}
   else if(eq(t,w[w.length-1])){ch.push(...w.slice().reverse().slice(1));m=true;}
   else if(eq(h,w[w.length-1])){ch.unshift(...w.slice(0,-1));m=true;}
   else if(eq(h,w[0])){ch.unshift(...w.slice().reverse().slice(0,-1));m=true;}
   if(m){rem.splice(i,1);break;}
  }}
  if(ch.length>2)rings.push(ch);
 }
 return rings;
}

function pointInPolygon(lat,lon,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
  if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}

function pointInPark(lat,lon,rings){
 return rings.some(r=>pointInPolygon(lat,lon,r));
}

function polyArea(rings){
 let t=0;
 for(const ring of rings){
  if(!ring||ring.length<3)continue;
  const kx=111320*Math.cos(ring[0][0]*Math.PI/180),ky=110540;
  let a=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   a+=(ring[j][1]*kx)*(ring[i][0]*ky)-(ring[i][1]*kx)*(ring[j][0]*ky);
  }
  t+=Math.abs(a/2);
 }
 return t;
}

// --- Park modu ---
function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?"Şimdi parkın içine tıkla.":"Açınca parkın içine tıkla.";
 bindParkClick();
 if(!PARK_MODE){PARK_CANDS=[];clearPark();}
}

function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sorgulanıyor…","info");
  const parks=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!parks||!parks.length)return toast("Park bulunamadı. Parkın içine tıkla.","warn");
  PARK_CANDS=parks;
  drawPark(parks[0]);
 });
}

// --- Park çizimi (BASİT ARAYÜZ) ---
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
 const waterArea=WATER_RINGS.length?polyArea(WATER_RINGS):0;
 const haLand=(Math.max(0,park.area-waterArea)/10000).toFixed(1);
 const alt=PARK_CANDS.length>1
  ?`<select id="parkAlt" onchange="switchPark(+this.value)" style="margin-left:6px">${PARK_CANDS.map((c,i)=>`<option value="${i}"${c===park?" selected":""}>${esc(c.name||"Alan "+(i+1))} (${((c.area-waterArea)/10000).toFixed(1)} ha)</option>`).join("")}</select>`:"";
 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=
  `<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · Kara: <b>${haLand} ha</b>${alt}<br>`+
  `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+
  `<label>Proje:</label><select id="gridProject">${(typeof PROJ_LIST!=="undefined"&&PROJ_LIST.length)?PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(""):`<option value="0">Önce proje oluştur</option>`}</select>`+
  `<label>Grid:</label><select id="gridSize"><option value="10">10 m</option><option value="20" selected>20 m</option><option value="50">50 m</option></select>`+
  `<label>Eşik:</label><select id="gridThresh"><option value="1">1+</option><option value="2">2+</option><option value="3" selected>3+</option><option value="5">5+</option></select></div>`+
  `<div style="margin-top:8px"><button class="btn sm blue" onclick="buildGrid()">🔲 Grid Oluştur</button> <button class="btn sm" onclick="clearGrid()">✕ Temizle</button></div>`+
  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;
 toast("✓ Park bulundu: "+haLand+" ha kara","ok","🌳");
}

function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 if(WATER_LAYER&&map){map.removeLayer(WATER_LAYER);WATER_LAYER=null;}
 if(IMP_LAYER&&map){map.removeLayer(IMP_LAYER);IMP_LAYER=null;}
 WATER_RINGS=[];IMP_NODES=[];PARK_POLY=null;
 const pi=$("parkInfo");if(pi){pi.style.display="none";pi.innerHTML="";}
}

function switchPark(i){const p=PARK_CANDS[i];if(p)drawPark(p);}

// --- Grid oluştur ---
async function buildGrid(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const size=+$("gridSize").value||20;
 const est=Math.round(polyArea(PARK_POLY)/(size*size));
 if(est>2500)return toast("Çok büyük. 50 m seç.","err");
 clearGrid();
 toast("⏳ Grid hesaplanıyor…","info");
 await new Promise(r=>setTimeout(r,50));
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
   if(!isCellValid(s0,s1,w0,w1))continue;
   const cell={lat:s0+dLat/2,lon:w0+dLon/2,s0,s1,w0,w1,n:0};
   cellMap[rI+"_"+cI]=cell;GRID_CELLS.push(cell);
  }
 }
 const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı")
  .gte("lat",minLat).lte("lat",maxLat).gte("lon",minLon).lte("lon",maxLon).limit(5000);
 (data||[]).forEach(m=>{
  const cell=cellMap[Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon)];
  if(cell)cell.n++;
 });
 GRID_LAYER=L.layerGroup().addTo(map);
 const thresh=+$("gridThresh").value||3;
 let g=0,y=0,r0=0;
 GRID_CELLS.forEach(cell=>{
  const col=cell.n===0?"#e11d48":cell.n<thresh?"#f59e0b":"#16a34a";
  if(cell.n===0)r0++;else if(cell.n<thresh)y++;else g++;
  L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{color:col,weight:1.2,fillColor:col,fillOpacity:.32,interactive:false}).addTo(GRID_LAYER);
 });
 $("gridSummary").innerHTML=
  `Hücre: <b>${GRID_CELLS.length}</b> · 🟢 ${g} yeterli · 🟡 ${y} az · <b style="color:#e11d48">🔴 ${r0} boş</b>`+
  (r0>0?`<div style="margin-top:8px"><button class="btn sm blue" onclick="createWaypoints()">📍 ${r0} Boş Hücreye Waypoint Oluştur</button></div>`:"");
 toast("✓ Grid hazır: "+GRID_CELLS.length+" hücre","ok","🔲");
}

function clearGrid(){
 if(GRID_LAYER&&map){map.removeLayer(GRID_LAYER);GRID_LAYER=null;}
 if(WP_AUTO_LAYER&&map){map.removeLayer(WP_AUTO_LAYER);WP_AUTO_LAYER=null;}
 GRID_CELLS.length=0;
 const gs=$("gridSummary");if(gs)gs.innerHTML="";
}

// --- Tek tıkla waypoint (TEK BUTON) ---
async function createWaypoints(){
 const pid=+$("gridProject").value||0;
 if(!pid)return toast("Önce proje seç","warn");
 const empty=GRID_CELLS.filter(c=>c.n===0);
 if(!empty.length)return toast("Boş hücre yok","ok");
 if(empty.length>500&&!confirm(empty.length+" waypoint oluşturulacak. Devam?"))return;
 const{data:mx}=await sb.from("waypoints").select("wp_id").eq("project_id",pid).order("wp_id",{ascending:false}).limit(1);
 let next=(mx&&mx.length?mx[0].wp_id:0)+1;
 const first=next;
 const rows=empty.map(c=>({owner:USER.id,project_id:pid,wp_id:next++,lat:+c.lat.toFixed(6),lon:+c.lon.toFixed(6),visited:false}));
 const{error}=await sb.from("waypoints").insert(rows);
 if(error)return toast("Hata: "+error.message,"err");
 if(WP_AUTO_LAYER&&map)map.removeLayer(WP_AUTO_LAYER);
 WP_AUTO_LAYER=L.layerGroup().addTo(map);
 rows.forEach(r=>L.circleMarker([r.lat,r.lon],{radius:5,color:"#fff",weight:1.5,fillColor:"#e11d48",fillOpacity:.95,interactive:false}).addTo(WP_AUTO_LAYER));
 if($("nProject"))$("nProject").value=String(pid);
 loadWaypoints();
 toast("✓ "+rows.length+" waypoint hazır (P"+first+"–P"+(next-1)+")","ok","📍");
}
