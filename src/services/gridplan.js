"use strict";

/* =========================================================
 * DendroGeo v2 · gridplan.js v17 (TAMAMEN DÜZELTİLMİŞ)
 *
 * İKİ AŞAMALI OVERPASS: Önce park, sonra park içinde su/bina
 * GERÇEK GEOMETRİK FİLTRE: Hücrenin tamamı kontrol edilir
 * ========================================================= */

let PARK_POLY=null;
let PARK_LAYER=null;
let PARK_MODE=false;
let PARK_CLICK_BOUND=false;
let PARK_CANDS=[];

let WATER_RINGS=[];
let WATER_LINES=[];
let WATER_LAYER=null;

let IMP_RINGS=[];
let IMP_LINES=[];
let IMP_LAYER=null;

const GRID_CELLS=[];
let GRID_LAYER=null;
let WP_AUTO_LAYER=null;

const SELECTED_CELLS=new Set();
let LAST_WP_ROWS=[];

/* =========================================================
 * AYARLAR
 * ========================================================= */

const WATER_CLEARANCE_M=1;
const IMP_CLEARANCE_M=1;

const OVERPASS_URLS=[
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass.openstreetmap.fr/api/interpreter",
 "https://overpass.osm.ch/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass-api.de/api/interpreter"
];

/* =========================================================
 * METRESEL PROJEKSİYON
 * ========================================================= */

function projectPoint(lat,lon,refLat){
 const kx=111320*Math.cos(refLat*Math.PI/180);
 const ky=110540;
 return {x:lon*kx, y:lat*ky};
}

/* =========================================================
 * BBOX
 * ========================================================= */

function ringBBox(ring,refLat){
 let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
 for(const p of ring){
  const q=projectPoint(p[0],p[1],refLat);
  if(q.x<minX)minX=q.x;
  if(q.y<minY)minY=q.y;
  if(q.x>maxX)maxX=q.x;
  if(q.y>maxY)maxY=q.y;
 }
 return {minX, minY, maxX, maxY};
}

function expandBBox(b,d){
 return {minX:b.minX-d, minY:b.minY-d, maxX:b.maxX+d, maxY:b.maxY+d};
}

function bboxesOverlap(a,b){
 return !(a.maxX<b.minX || a.minX>b.maxX || a.maxY<b.minY || a.minY>b.maxY);
}

/* =========================================================
 * NOKTA POLYGON İÇİNDE Mİ?
 * ========================================================= */

function pointInPolygonXY(x,y,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i].x, yi=poly[i].y;
  const xj=poly[j].x, yj=poly[j].y;
  if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)){
   inside=!inside;
  }
 }
 return inside;
}

function pointInPolygon(lat,lon,ring){
 if(!ring||ring.length<3)return false;
 const refLat=lat;
 const p=projectPoint(lat,lon,refLat);
 const poly=ring.map(q=>projectPoint(q[0],q[1],refLat));
 return pointInPolygonXY(p.x,p.y,poly);
}

function pointInPark(lat,lon,rings){
 if(!rings||!rings.length)return false;
 return rings.some(r=>pointInPolygon(lat,lon,r));
}

/* =========================================================
 * SEGMENT KESİŞİMİ
 * ========================================================= */

function orientation(a,b,c){
 const v=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 if(Math.abs(v)<1e-9)return 0;
 return v>0?1:2;
}

function onSegment(a,b,p){
 return (p.x>=Math.min(a.x,b.x)-1e-9 && p.x<=Math.max(a.x,b.x)+1e-9 &&
         p.y>=Math.min(a.y,b.y)-1e-9 && p.y<=Math.max(a.y,b.y)+1e-9);
}

function segmentsIntersect(a,b,c,d){
 const o1=orientation(a,b,c);
 const o2=orientation(a,b,d);
 const o3=orientation(c,d,a);
 const o4=orientation(c,d,b);
 if(o1!==o2&&o3!==o4)return true;
 if(o1===0&&onSegment(a,b,c))return true;
 if(o2===0&&onSegment(a,b,d))return true;
 if(o3===0&&onSegment(c,d,a))return true;
 if(o4===0&&onSegment(c,d,b))return true;
 return false;
}

/* =========================================================
 * DİKDÖRTGEN KÖŞELERİ
 * ========================================================= */

function rectCorners(rect){
 return [
  {x:rect.minX, y:rect.minY},
  {x:rect.maxX, y:rect.minY},
  {x:rect.maxX, y:rect.maxY},
  {x:rect.minX, y:rect.maxY}
 ];
}

/* =========================================================
 * SEGMENT → RECTANGLE
 * ========================================================= */

function segmentIntersectsRect(a,b,rect){
 const cs=rectCorners(rect);
 for(let i=0;i<4;i++){
  if(segmentsIntersect(a,b,cs[i],cs[(i+1)%4]))return true;
 }
 if(a.x>=rect.minX&&a.x<=rect.maxX&&a.y>=rect.minY&&a.y<=rect.maxY)return true;
 if(b.x>=rect.minX&&b.x<=rect.maxX&&b.y>=rect.minY&&b.y<=rect.maxY)return true;
 return false;
}

/* =========================================================
 * POLYGON → CELL
 * ========================================================= */

function geometryIntersectsRect(points,rect,refLat,bufferM=0){
 if(!points||points.length<2)return false;
 const pts=points.map(p=>projectPoint(p[0],p[1],refLat));
 const gb=expandBBox(ringBBox(points,refLat),bufferM);
 const testRect=expandBBox(rect,bufferM);
 if(!bboxesOverlap(gb,testRect))return false;
 for(const p of pts){
  if(p.x>=testRect.minX&&p.x<=testRect.maxX&&p.y>=testRect.minY&&p.y<=testRect.maxY)return true;
 }
 const corners=rectCorners(testRect);
 for(const c of corners){
  if(pointInPolygonXY(c.x,c.y,pts))return true;
 }
 for(let i=0;i<pts.length;i++){
  const a=pts[i], b=pts[(i+1)%pts.length];
  if(segmentIntersectsRect(a,b,testRect))return true;
 }
 return false;
}

/* =========================================================
 * ÇİZGİ → CELL
 * ========================================================= */

function geometryLineIntersectsRect(points,rect,refLat,bufferM=0){
 if(!points||points.length<2)return false;
 const gb=expandBBox(ringBBox(points,refLat),bufferM);
 const testRect=expandBBox(rect,bufferM);
 if(!bboxesOverlap(gb,testRect))return false;
 const pts=points.map(p=>projectPoint(p[0],p[1],refLat));
 for(let i=0;i<pts.length-1;i++){
  if(segmentIntersectsRect(pts[i],pts[i+1],testRect))return true;
 }
 return false;
}

/* =========================================================
 * CELL PARK İÇİNDE Mİ?
 * ========================================================= */

function cellInsidePark(s0,s1,w0,w1){
 const cLat=(s0+s1)/2;
 const cLon=(w0+w1)/2;
 const samples=[[s0,w0],[s0,w1],[s1,w1],[s1,w0],[cLat,cLon]];
 for(const p of samples){
  if(!pointInPark(p[0],p[1],PARK_POLY))return false;
 }
 const cell=[
  projectPoint(s0,w0,cLat),
  projectPoint(s0,w1,cLat),
  projectPoint(s1,w1,cLat),
  projectPoint(s1,w0,cLat)
 ];
 for(const ring of PARK_POLY){
  const poly=ring.map(p=>projectPoint(p[0],p[1],cLat));
  for(let i=0;i<poly.length;i++){
   const a=poly[i], b=poly[(i+1)%poly.length];
   for(let j=0;j<4;j++){
    if(segmentsIntersect(a,b,cell[j],cell[(j+1)%4]))return false;
   }
  }
 }
 return true;
}

/* =========================================================
 * CELL GEÇERLİ Mİ?
 * ========================================================= */

function isCellValid(s0,s1,w0,w1){
 if(!cellInsidePark(s0,s1,w0,w1))return false;
 const cLat=(s0+s1)/2;
 const cellRect=ringBBox([[s0,w0],[s0,w1],[s1,w1],[s1,w0]],cLat);
 for(const water of WATER_RINGS){
  if(geometryIntersectsRect(water,cellRect,cLat,WATER_CLEARANCE_M))return false;
 }
 for(const line of WATER_LINES){
  if(geometryLineIntersectsRect(line,cellRect,cLat,WATER_CLEARANCE_M))return false;
 }
 for(const building of IMP_RINGS){
  if(geometryIntersectsRect(building,cellRect,cLat,IMP_CLEARANCE_M))return false;
 }
 for(const line of IMP_LINES){
  if(geometryLineIntersectsRect(line,cellRect,cLat,IMP_CLEARANCE_M))return false;
 }
 return true;
}

/* =========================================================
 * OVERPASS — İKİ AŞAMALI (PARK + ÖZELLİKLER)
 * ========================================================= */

async function queryPark(lat,lon,radius=1200){

 /* =====================================================
  * 1. AŞAMA: SADECE PARKI BUL (hafif sorgu)
  * ===================================================== */

 const q1=
  `[out:json][timeout:25];(`+
  `way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:${radius},${lat},${lon});`+
  `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
  `);out geom;`;

 let parkData=null;

 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q1));
   if(!res.ok)continue;
   parkData=await res.json();
   break;
  }catch(e){
   console.warn("Park sorgusu hata:",url,e);
  }
 }

 if(!parkData||!parkData.elements||!parkData.elements.length){
  return null;
 }

 const cands=[];
 for(const el of parkData.elements){
  const rings=extractRings(el);
  if(!rings||!rings.length)continue;
  cands.push({
   rings,
   name:(el.tags&&el.tags.name)||null,
   area:polyArea(rings)
  });
 }

 if(!cands.length)return null;

 const inside=cands.filter(c=>pointInPark(lat,lon,c.rings));
 const sorted=(inside.length?inside:cands).slice().sort((a,b)=>b.area-a.area);
 const park=sorted[0];

 /* =====================================================
  * 2. AŞAMA: PARKIN BBOX'INDA SU/BİNA/YOL ARA
  * ===================================================== */

 WATER_RINGS=[];
 WATER_LINES=[];
 IMP_RINGS=[];
 IMP_LINES=[];

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 park.rings.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];
  if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];
  if(p[1]>maxLon)maxLon=p[1];
 }));

 const pad=0.0003;
 const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

 const q2=
  `[out:json][timeout:60];(`+
  `way["natural"="water"](${bbox});`+
  `relation["natural"="water"](${bbox});`+
  `way["building"](${bbox});`+
  `way["highway"~"residential|primary|secondary|tertiary|service|footway|path|cycleway|track|unclassified"](${bbox});`+
  `);out geom;`;

 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q2));
   if(!res.ok)continue;
   const json=await res.json();
   for(const el of (json.elements||[])){
    if(isWater(el)){
     collectWaterGeometry(el);
     continue;
    }
    if(isImpervious(el)){
     collectImperviousGeometry(el);
     continue;
    }
   }
     const pb={minLat,maxLat,minLon,maxLon};
   WATER_RINGS=WATER_RINGS.filter(r=>ringTouchesPark(r,park.rings,pb));
   WATER_LINES=WATER_LINES.filter(l=>lineTouchesPark(l,park.rings,pb));
   IMP_RINGS=IMP_RINGS.filter(r=>ringTouchesPark(r,park.rings,pb));
   IMP_LINES=IMP_LINES.filter(l=>lineTouchesPark(l,park.rings,pb));
   console.log("✓ Park içi → Su:",WATER_RINGS.length,"Bina:",IMP_RINGS.length,"Yol:",IMP_LINES.length);
   break;
   break;
  }catch(e){
   console.warn("Özellik sorgusu hata:",url,e);
  }
 }

 return sorted;
}

/* =========================================================
 * RING ÇIKAR
 * ========================================================= */

function extractRings(el){
 if(el.type==="way"&&el.geometry){
  const r=el.geometry.map(g=>[g.lat,g.lon]);
  return r.length>2?[r]:null;
 }
 if(el.type==="relation"&&el.members){
  const outer=el.members.filter(m=>m.role==="outer"&&m.geometry)
   .map(m=>m.geometry.map(g=>[g.lat,g.lon]));
  if(!outer.length)return null;
  return joinWaysToRings(outer);
 }
 return null;
}

/* =========================================================
 * SU MU?
 * ========================================================= */

function isWater(el){
 const t=el.tags||{};
 return (
  t.natural==="water"||
  t.landuse==="reservoir"||
  t.landuse==="basin"||
  t.leisure==="swimming_pool"||
  !!t.waterway
 );
}

/* =========================================================
 * KATI ZEMİN?
 * ========================================================= */

function isImpervious(el){
 const t=el.tags||{};
 return (
  !!t.building||
  !!t.highway||
  t.landuse==="commercial"||
  t.landuse==="industrial"||
  t.landuse==="retail"||
  t.landuse==="construction"
 );
}

/* =========================================================
 * KAPALI ÇİZGİ
 * ========================================================= */

function isClosedLine(line){
 if(!line||line.length<3)return false;
 return (
  Math.abs(line[0][0]-line[line.length-1][0])<1e-9 &&
  Math.abs(line[0][1]-line[line.length-1][1])<1e-9
 );
}

/* =========================================================
 * SU GEOMETRİSİ TOPLA
 * ========================================================= */

function collectWaterGeometry(el){
 if(el.type==="relation"){
  const rings=extractRings(el);
  if(rings)WATER_RINGS.push(...rings);
  return;
 }
 if(!el.geometry)return;
 const line=el.geometry.map(g=>[g.lat,g.lon]);
 const t=el.tags||{};
 if(isClosedLine(line)&&(
  t.natural==="water"||
  t.landuse==="reservoir"||
  t.landuse==="basin"||
  t.waterway==="riverbank"
 )){
  WATER_RINGS.push(line);
 }else if(line.length>1){
  WATER_LINES.push(line);
 }
}

/* =========================================================
 * BİNA / YOL GEOMETRİSİ TOPLA
 * ========================================================= */

function collectImperviousGeometry(el){
 if(el.type==="relation"){
  const rings=extractRings(el);
  if(rings)IMP_RINGS.push(...rings);
  return;
 }
 if(!el.geometry)return;
 const line=el.geometry.map(g=>[g.lat,g.lon]);
 const t=el.tags||{};
 if(t.building){
  if(isClosedLine(line))IMP_RINGS.push(line);
  else IMP_LINES.push(line);
  return;
 }
 if(t.highway){
  IMP_LINES.push(line);
  return;
 }
 if(t.landuse){
  if(isClosedLine(line))IMP_RINGS.push(line);
  else IMP_LINES.push(line);
  return;
 }
 IMP_LINES.push(line);
}

/* =========================================================
 * PARK DIŞI FİLTRE: özellik parka değiyor mu?
 * ========================================================= */

function ringTouchesPark(ring,parkRings,pb){
 let mnLa=90,mxLa=-90,mnLo=180,mxLo=-180;
 for(const p of ring){
  if(p[0]<mnLa)mnLa=p[0];if(p[0]>mxLa)mxLa=p[0];
  if(p[1]<mnLo)mnLo=p[1];if(p[1]>mxLo)mxLo=p[1];
 }
 if(mxLa<pb.minLat||mnLa>pb.maxLat||mxLo<pb.minLon||mnLo>pb.maxLon)return false;
 for(const p of ring){if(pointInPark(p[0],p[1],parkRings))return true;}
 for(const pr of parkRings){for(const p of pr){if(pointInPolygon(p[0],p[1],ring))return true;}}
 return false;
}

function lineTouchesPark(line,parkRings,pb){
 let mnLa=90,mxLa=-90,mnLo=180,mxLo=-180;
 for(const p of line){
  if(p[0]<mnLa)mnLa=p[0];if(p[0]>mxLa)mxLa=p[0];
  if(p[1]<mnLo)mnLo=p[1];if(p[1]>mxLo)mxLo=p[1];
 }
 if(mxLa<pb.minLat||mnLa>pb.maxLat||mxLo<pb.minLon||mnLo>pb.maxLon)return false;
 for(const p of line){if(pointInPark(p[0],p[1],parkRings))return true;}
 const m=line[Math.floor(line.length/2)];
 return pointInPark(m[0],m[1],parkRings);
}
/* =========================================================
 * WAY → RING BİRLEŞTİR
 * ========================================================= */

function joinWaysToRings(ways){
 const rings=[], rem=ways.slice();
 const eq=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
 while(rem.length){
  const ch=rem.shift().slice();
  let m=true, guard=ways.length*2+10;
  while(m&&guard-->0){
   m=false;
   for(let i=0;i<rem.length;i++){
    const w=rem[i];
    const h=ch[0], t=ch[ch.length-1];
    if(eq(t,w[0])){ch.push(...w.slice(1));m=true;}
    else if(eq(t,w[w.length-1])){ch.push(...w.slice().reverse().slice(1));m=true;}
    else if(eq(h,w[w.length-1])){ch.unshift(...w.slice(0,-1));m=true;}
    else if(eq(h,w[0])){ch.unshift(...w.slice().reverse().slice(0,-1));m=true;}
    if(m){rem.splice(i,1);break;}
   }
  }
  if(ch.length>2)rings.push(ch);
 }
 return rings;
}

/* =========================================================
 * ALAN HESAPLA
 * ========================================================= */

function polyArea(rings){
 let t=0;
 for(const ring of rings){
  if(!ring||ring.length<3)continue;
  const kx=111320*Math.cos(ring[0][0]*Math.PI/180);
  const ky=110540;
  let a=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   a+=(ring[j][1]*kx)*(ring[i][0]*ky)-(ring[i][1]*kx)*(ring[j][0]*ky);
  }
  t+=Math.abs(a/2);
 }
 return t;
}

/* =========================================================
 * ESKİ API UYUMLULUK
 * ========================================================= */

function pointInWater(lat,lon){
 return WATER_RINGS.some(r=>pointInPolygon(lat,lon,r));
}

function nearWater(lat,lon){
 const dLat=WATER_CLEARANCE_M/110540;
 const dLon=WATER_CLEARANCE_M/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
 const rect=ringBBox([
  [lat-dLat,lon-dLon],
  [lat-dLat,lon+dLon],
  [lat+dLat,lon+dLon],
  [lat+dLat,lon-dLon]
 ],lat);
 return (
  WATER_RINGS.some(r=>geometryIntersectsRect(r,rect,lat,0))||
  WATER_LINES.some(l=>geometryLineIntersectsRect(l,rect,lat,0))
 );
}

function nearImpervious(lat,lon){
 const dLat=IMP_CLEARANCE_M/110540;
 const dLon=IMP_CLEARANCE_M/(111320*Math.max(.1,Math.cos(lat*Math.PI/180)));
 const rect=ringBBox([
  [lat-dLat,lon-dLon],
  [lat-dLat,lon+dLon],
  [lat+dLat,lon+dLon],
  [lat+dLat,lon-dLon]
 ],lat);
 return (
  IMP_RINGS.some(r=>geometryIntersectsRect(r,rect,lat,0))||
  IMP_LINES.some(l=>geometryLineIntersectsRect(l,rect,lat,0))
 );
}

function isValidSpot(lat,lon){
 return !pointInWater(lat,lon)&&!nearWater(lat,lon)&&!nearImpervious(lat,lon);
}

/* =========================================================
 * PARK MODU
 * ========================================================= */

function toggleParkMode(){
 PARK_MODE=!PARK_MODE;
 const b=$("parkModeBtn");
 b.textContent="🌳 Park Analizi Modu: "+(PARK_MODE?"AÇIK":"KAPALI");
 b.className="btn sm "+(PARK_MODE?"":"blue");
 $("parkModeHint").textContent=PARK_MODE?
  "Şimdi haritada bir parkın İÇİNE tıkla.":
  "Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
 bindParkClick();
 if(!PARK_MODE){PARK_CANDS=[];clearPark();}
}

/* =========================================================
 * PARK CLICK
 * ========================================================= */

function bindParkClick(){
 if(PARK_CLICK_BOUND||!map)return;
 PARK_CLICK_BOUND=true;
 map.on("click",async e=>{
  if(!PARK_MODE)return;
  toast("🌳 Park sınırı sorgulanıyor…","info");
  const parks=await queryPark(e.latlng.lat,e.latlng.lng);
  if(!parks||!parks.length){
   return toast("Park bulunamadı veya Overpass yoğun. 10 sn sonra tekrar dene.","warn");
  }
  PARK_CANDS=parks;
  drawPark(parks[0]);
 });
}

/* =========================================================
 * PARK ÇİZ
 * ========================================================= */
function drawPark(park){
 clearPark();
 clearGrid();
 PARK_POLY=park.rings;
 PARK_LAYER=L.polygon(park.rings,{color:"#2b6cb0",weight:2.5,dashArray:"6,6",fillColor:"#3b82f6",fillOpacity:.10,interactive:false}).addTo(map);

 if(WATER_RINGS.length){
  WATER_LAYER=L.layerGroup().addTo(map);
  WATER_RINGS.forEach(ring=>{
   L.polygon(ring,{color:"#2563eb",weight:1,fillColor:"#60a5fa",fillOpacity:.4,interactive:false}).addTo(WATER_LAYER);
  });
 }
 if(WATER_LINES.length){
  if(!WATER_LAYER)WATER_LAYER=L.layerGroup().addTo(map);
  WATER_LINES.forEach(line=>{
   L.polyline(line,{color:"#2563eb",weight:2,opacity:.5,interactive:false}).addTo(WATER_LAYER);
  });
 }
 if(IMP_RINGS.length||IMP_LINES.length){
  IMP_LAYER=L.layerGroup().addTo(map);
  IMP_RINGS.forEach(ring=>{
   L.polygon(ring,{color:"#9ca3af",weight:.7,fillColor:"#9ca3af",fillOpacity:.18,interactive:false}).addTo(IMP_LAYER);
  });
  IMP_LINES.forEach(line=>{
   L.polyline(line,{color:"#9ca3af",weight:2,opacity:.45,interactive:false}).addTo(IMP_LAYER);
  });
 }

 map.fitBounds(PARK_LAYER.getBounds(),{padding:[30,30]});

 const haTotal=(park.area/10000).toFixed(1);

 const alt=PARK_CANDS.length>1?
  `<select id="parkAlt" onchange="switchPark(+this.value)" style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
  PARK_CANDS.map((c,i)=>
   `<option value="${i}"${c===park?" selected":""}>${esc(c.name||"Alan "+(i+1))} · ${(c.area/10000).toFixed(1)} ha</option>`
  ).join("")+
  `</select>`:"";

 $("parkInfo").style.display="block";
 $("parkInfo").innerHTML=
  `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">`+
   `<b style="font-size:1.08rem">🌳 ${esc(park.name||"İsimsiz Park")}</b>`+
   `<span style="background:#14532d;color:#fff;font-size:.78rem;padding:3px 12px;border-radius:999px">Toplam: ${haTotal} ha</span>`+
   alt+
  `</div>`+
  `<div style="font-size:.72rem;color:var(--mut);margin-top:4px">Sınır: OpenStreetMap poligonu · filtre: su/bina/yol 1 m · tüm hesaplar yalnızca park içi</div>`+

  `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:12px">`+

   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">1 · GRID KURULUMU</div>`+
    `<div style="display:grid;gap:6px">`+
     `<label style="font-size:.78rem">Proje<select id="gridProject" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
     (typeof PROJ_LIST!=="undefined"&&PROJ_LIST.length?
      PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(""):
      `<option value="0">Önce proje oluştur</option>`)+
     `</select></label>`+
     `<label style="font-size:.78rem">Grid boyutu<select id="gridSize" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
      `<option value="10">10×10 m</option><option value="20" selected>20×20 m</option><option value="50">50×50 m</option>`+
     `</select></label>`+
     `<label style="font-size:.78rem">Yeterli eşik<select id="gridThresh" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line);margin-top:2px">`+
      `<option value="1">1+</option><option value="2">2+</option><option value="3" selected>3+</option><option value="5">5+</option>`+
     `</select></label>`+
    `</div>`+
    `<button class="btn sm blue" style="width:100%;margin-top:8px" onclick="buildGrid()">🔲 Grid Oluştur</button>`+
   `</div>`+

   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">2 · ANALİZ & RAPOR</div>`+
    `<button class="btn sm" style="width:100%" onclick="runLandCoverAnalysis()">🌿 Yeşil / Sert / Su Analizi</button>`+
    `<div style="font-size:.75rem;color:var(--mut);margin:8px 0 4px">PNG raporu içeriği:</div>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngGrid" checked> Grid hücreleri</label>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngWp" checked> Waypoint'ler</label>`+
    `<label style="font-size:.78rem;display:block"><input type="checkbox" id="chkPngCover" checked> Su / sert zemin</label>`+
    `<button class="btn sm ghost" style="width:100%;margin-top:8px" onclick="downloadParkImage()">🖼️ Rapor PNG İndir</button>`+
   `</div>`+

   `<div style="border:1px solid var(--line);border-radius:10px;padding:10px">`+
    `<div style="font-size:.7rem;letter-spacing:.08em;color:var(--mut);margin-bottom:8px">3 · KATMAN & TEMİZLİK</div>`+
    `<div style="display:grid;gap:6px">`+
     `<button class="btn sm" id="gridVisBtn" onclick="toggleGridVis()">🔲 Grid: GÖRÜNÜR</button>`+
     `<button class="btn sm" id="wpVisBtn" onclick="toggleWpVis()">📍 Waypoint: GÖRÜNÜR</button>`+
     `<button class="btn sm red" onclick="clearGrid()">✕ Grid'i Temizle</button>`+
    `</div>`+
   `</div>`+

  `</div>`+
  `<div id="landCoverReport" style="margin-top:10px;font-size:.82rem;line-height:1.6"></div>`+
  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;

 toast("✓ Park algılandı: "+haTotal+" ha (toplam alan)","ok","🌳");
}

/* =========================================================
 * PARK TEMİZLE
 * ========================================================= */

function clearPark(){
 if(PARK_LAYER&&map){map.removeLayer(PARK_LAYER);PARK_LAYER=null;}
 if(WATER_LAYER&&map){map.removeLayer(WATER_LAYER);WATER_LAYER=null;}
 if(IMP_LAYER&&map){map.removeLayer(IMP_LAYER);IMP_LAYER=null;}
 PARK_POLY=null;
}

/* =========================================================
 * PARK DEĞİŞTİR
 * ========================================================= */

function switchPark(i){
 const p=PARK_CANDS[i];
 if(p)drawPark(p);
}

/* =========================================================
 * GRID OLUŞTUR
 * ========================================================= */

async function buildGrid(){
 if(!PARK_POLY||!PARK_POLY.length){
  return toast("Önce park seç");
 }
 const size=+$("gridSize").value||20;
 const thresh=+$("gridThresh").value||3;
 const est=Math.round(polyArea(PARK_POLY)/(size*size));
 if(est>3000){
  return toast("⚠ ~"+est+" hücre çok yoğun. 50×50 m seç.","err");
 }
 if(est>800&&!confirm(`⚠ ~${est} hücre oluşturulacak.\nDevam?`)){
  return;
 }
 clearGrid();

 let minLat=90, maxLat=-90, minLon=180, maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];
  if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];
  if(p[1]>maxLon)maxLon=p[1];
 }));

 const lat0=((minLat+maxLat)/2)*Math.PI/180;
 const dLat=size/110540;
 const dLon=size/(111320*Math.max(.1,Math.cos(lat0)));

 const cellMap={};
 GRID_CELLS.length=0;

 for(let rI=0;;rI++){
  const s0=minLat+rI*dLat;
  const s1=s0+dLat;
  if(s0>=maxLat)break;
  for(let cI=0;;cI++){
   const w0=minLon+cI*dLon;
   const w1=w0+dLon;
   if(w0>=maxLon)break;
   if(!isCellValid(s0,s1,w0,w1))continue;
   const cell={
    lat:(s0+s1)/2,
    lon:(w0+w1)/2,
    s0,s1,w0,w1,
    n:0,
    id:rI+"_"+cI
   };
   cellMap[cell.id]=cell;
   GRID_CELLS.push(cell);
  }
 }

 const{data}=await sb.from("measurements")
  .select("lat,lon")
  .eq("status","Onaylı")
  .gte("lat",minLat)
  .lte("lat",maxLat)
  .gte("lon",minLon)
  .lte("lon",maxLon)
  .limit(5000);

 (data||[]).forEach(m=>{
  const key=Math.floor((m.lat-minLat)/dLat)+"_"+Math.floor((m.lon-minLon)/dLon);
  const cell=cellMap[key];
  if(cell)cell.n++;
 });

 SELECTED_CELLS.clear();
 drawGridLayer();
 toast("✓ Güvenli grid hazır: "+GRID_CELLS.length+" hücre","ok","🔲");
}

/* =========================================================
 * GRID ÇİZ
 * ========================================================= */

function drawGridLayer(){
 if(GRID_LAYER&&map)map.removeLayer(GRID_LAYER);
 GRID_LAYER=L.layerGroup().addTo(map);
 const thresh=+$("gridThresh")?.value||3;
 let g=0, y=0, r0=0;

 GRID_CELLS.forEach(cell=>{
  const col=cell.n===0?"#e11d48":(cell.n<thresh?"#f59e0b":"#16a34a");
  if(cell.n===0)r0++;
  else if(cell.n<thresh)y++;
  else g++;

  const isSel=SELECTED_CELLS.has(cell.id);
  const rect=L.rectangle([[cell.s0,cell.w0],[cell.s1,cell.w1]],{
   color:isSel?"#1d4ed8":col,
   weight:isSel?3:1.2,
   fillColor:isSel?"#3b82f6":col,
   fillOpacity:isSel?.55:.32,
   interactive:true
  }).addTo(GRID_LAYER);

  rect._cellId=cell.id;

  rect.on("click",e=>{
   L.DomEvent.stopPropagation(e);
   toggleCellSelection(cell.id,rect);
  });

  rect.bindTooltip(`Hücre ${cell.id} · ${cell.n} ölçüm · Tıkla: seç/kaldır`,{sticky:true});
 });

 updateGridSummary(g,y,r0);
}

/* =========================================================
 * GRID ÖZET
 * ========================================================= */

function updateGridSummary(g,y,r0){
 const thresh=+$("gridThresh")?.value||3;
 const tot=GRID_CELLS.length;
 const pct=v=>tot?Math.round(v/tot*100):0;
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
  `<button class="btn sm ghost" onclick="downloadGridGeoJSON()">📥 Grid GeoJSON</button>`+
  `<button class="btn sm ghost" onclick="downloadWaypointsCSV()">📥 Waypoint CSV</button>`+
  `</div>`;
}

/* =========================================================
 * CELL SEÇ
 * ========================================================= */

function toggleCellSelection(cellId,rect){
 if(SELECTED_CELLS.has(cellId)){
  SELECTED_CELLS.delete(cellId);
  const cell=GRID_CELLS.find(c=>c.id===cellId);
  if(cell){
   const thresh=+$("gridThresh")?.value||3;
   const col=cell.n===0?"#e11d48":(cell.n<thresh?"#f59e0b":"#16a34a");
   rect.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});
  }
 }else{
  SELECTED_CELLS.add(cellId);
  rect.setStyle({color:"#1d4ed8",weight:3,fillColor:"#3b82f6",fillOpacity:.55});
 }

 let g=0, y=0, r0=0;
 const thresh=+$("gridThresh")?.value||3;
 GRID_CELLS.forEach(c=>{
  if(c.n===0)r0++;
  else if(c.n<thresh)y++;
  else g++;
 });
 updateGridSummary(g,y,r0);
}

/* =========================================================
 * SEÇİMİ TEMİZLE
 * ========================================================= */

function clearCellSelection(){
 SELECTED_CELLS.clear();
 if(GRID_LAYER){
  const thresh=+$("gridThresh")?.value||3;
  GRID_LAYER.eachLayer(l=>{
   if(l.setStyle&&l._cellId){
    const cellId=l._cellId;
    const cell=GRID_CELLS.find(c=>c.id===cellId);
    if(cell){
     const col=cell.n===0?"#e11d48":(cell.n<thresh?"#f59e0b":"#16a34a");
     l.setStyle({color:col,weight:1.2,fillColor:col,fillOpacity:.32});
    }
   }
  });
 }
 let g=0, y=0, r0=0;
 const thresh=+$("gridThresh")?.value||3;
 GRID_CELLS.forEach(c=>{
  if(c.n===0)r0++;
  else if(c.n<thresh)y++;
  else g++;
 });
 updateGridSummary(g,y,r0);
}

/* =========================================================
 * GRID TEMİZLE
 * ========================================================= */

function clearGrid(){
 if(GRID_LAYER&&map){map.removeLayer(GRID_LAYER);GRID_LAYER=null;}
 if(WP_AUTO_LAYER&&map){map.removeLayer(WP_AUTO_LAYER);WP_AUTO_LAYER=null;}
 GRID_CELLS.length=0;
 SELECTED_CELLS.clear();
 const gs=$("gridSummary");
 if(gs)gs.innerHTML="";
}

/* =========================================================
 * GRID GÖRÜNÜRLÜK
 * ========================================================= */

function toggleGridVis(){
 if(!GRID_LAYER)return;
 if(map.hasLayer(GRID_LAYER)){
  map.removeLayer(GRID_LAYER);
  $("gridVisBtn").textContent="🔲 Grid: GİZLİ";
 }else{
  map.addLayer(GRID_LAYER);
  $("gridVisBtn").textContent="🔲 Grid: GÖRÜNÜR";
 }
}

/* =========================================================
 * WAYPOINT GÖRÜNÜRLÜK
 * ========================================================= */

function toggleWpVis(){
 if(!WP_AUTO_LAYER)return;
 if(map.hasLayer(WP_AUTO_LAYER)){
  map.removeLayer(WP_AUTO_LAYER);
  $("wpVisBtn").textContent="📍 Waypoint: GİZLİ";
 }else{
  map.addLayer(WP_AUTO_LAYER);
  $("wpVisBtn").textContent="📍 Waypoint: GÖRÜNÜR";
 }
}

/* =========================================================
 * GRID → WAYPOINT
 * ========================================================= */

async function createWaypointsFromGrid(mode){
 if(!GRID_CELLS.length){
  return toast("Önce grid oluştur","warn");
 }
 const pid=+$("gridProject").value||0;
 if(!pid){
  return toast("Önce proje seç veya oluştur","warn");
 }

 let targetCells=[];

 if(mode==="manual"){
  if(!SELECTED_CELLS.size){
   return toast("Önce hücre seçin","warn");
  }
  targetCells=GRID_CELLS.filter(c=>SELECTED_CELLS.has(c.id));
 }else{
  targetCells=GRID_CELLS.filter(c=>c.n===0);
 }

 if(!targetCells.length){
  return toast("Uygun hücre yok","warn");
 }

 if(targetCells.length>500&&!confirm(targetCells.length+" waypoint oluşturulacak.\nDevam?")){
  return;
 }

 const{data:mx}=await sb.from("waypoints")
  .select("wp_id")
  .eq("project_id",pid)
  .order("wp_id",{ascending:false})
  .limit(1);

 let next=(mx&&mx.length?mx[0].wp_id:0)+1;
 const first=next;

 const rows=targetCells.map(c=>({
  owner:USER.id,
  project_id:pid,
  wp_id:next++,
  lat:+c.lat.toFixed(6),
  lon:+c.lon.toFixed(6),
  visited:false
 }));
 LAST_WP_ROWS=rows;
 const{error}=await sb.from("waypoints").insert(rows);

 if(error){
  return toast("Hata: "+error.message,"err");
 }

 if(WP_AUTO_LAYER&&map)map.removeLayer(WP_AUTO_LAYER);
 WP_AUTO_LAYER=L.layerGroup().addTo(map);
 rows.forEach(r=>
  L.circleMarker([r.lat,r.lon],{
   radius:5,
   color:"#fff",
   weight:1.5,
   fillColor:"#e11d48",
   fillOpacity:.95,
   interactive:false
  }).addTo(WP_AUTO_LAYER)
 );

 $("nProject").value=String(pid);
 loadWaypoints();

 toast("✓ "+rows.length+" waypoint oluşturuldu (P"+first+"–P"+(next-1)+")","ok","📍");
 clearCellSelection();
}
/* =========================================================
 * MODÜL 1: ÇIKTILAR + ARAZİ ÖRTÜSÜ ANALİZİ
 * ========================================================= */

function lineLengthM(l){
 let len=0;
 for(let i=1;i<l.length;i++){
  const dy=(l[i][0]-l[i-1][0])*110540;
  const dx=(l[i][1]-l[i-1][1])*111320*Math.cos(l[i][0]*Math.PI/180);
  len+=Math.sqrt(dx*dx+dy*dy);
 }
 return len;
}

function downloadBlob(name,mime,text){
 const b=new Blob([text],{type:mime});
 const u=URL.createObjectURL(b);
 const a=document.createElement("a");
 a.href=u;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(u),1000);
}

function downloadGridGeoJSON(){
 if(!GRID_CELLS.length)return toast("Önce grid oluştur","warn");
 const thresh=+$("gridThresh")?.value||3;
 const fc={
  type:"FeatureCollection",
  features:GRID_CELLS.map(c=>({
   type:"Feature",
   properties:{
    id:c.id,
    olcum:c.n,
    durum:c.n===0?"bos":(c.n<thresh?"az":"yeterli")
   },
   geometry:{
    type:"Polygon",
    coordinates:[[[c.w0,c.s0],[c.w1,c.s0],[c.w1,c.s1],[c.w0,c.s1],[c.w0,c.s0]]]
   }
  }))
 };
 downloadBlob("dendrogeo_grid.geojson","application/geo+json",JSON.stringify(fc,null,2));
 toast("✓ Grid GeoJSON indirildi ("+GRID_CELLS.length+" hücre)","ok","📥");
}

function downloadWaypointsCSV(){
 const rows=LAST_WP_ROWS.length?LAST_WP_ROWS:WP;
 if(!rows||!rows.length)return toast("İndirilecek waypoint yok","warn");
 let csv="wp_id,lat,lon,visited\n";
 rows.forEach(r=>{csv+=r.wp_id+","+r.lat+","+r.lon+","+(r.visited?1:0)+"\n";});
 downloadBlob("dendrogeo_waypoints.csv","text/csv",csv);
 toast("✓ "+rows.length+" waypoint CSV indirildi","ok","📥");
}

function buildNodeIndex(lines){
 const idx={};
 const cs=0.0004;
 lines.forEach(l=>l.forEach(p=>{
  const k=Math.floor(p[0]/cs)+"_"+Math.floor(p[1]/cs);
  (idx[k]=idx[k]||[]).push(p);
 }));
 return {idx,cs};
}

function nearLineIndex(index,lat,lon,dist){
 const cs=index.cs;
 const i0=Math.floor(lat/cs), j0=Math.floor(lon/cs);
 const d2=dist*dist;
 for(let i=i0-1;i<=i0+1;i++){
  for(let j=j0-1;j<=j0+1;j++){
   const arr=index.idx[i+"_"+j];
   if(!arr)continue;
   for(const p of arr){
    const dy=(p[0]-lat)*110540;
    const dx=(p[1]-lon)*111320*Math.cos(lat*Math.PI/180);
    if(dx*dx+dy*dy<d2)return true;
   }
  }
 }
 return false;
}

/* Yeşil/sert zemin — TEK SEFERLİK, sadece park içi 10m örneklem */
async function runLandCoverAnalysis(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
 const rep=$("landCoverReport");
 if(rep)rep.innerHTML="⏳ Arazi örtüsü sorgulanıyor…";
 toast("🌿 Yeşil/sert zemin sorgusu (tek seferlik)…","info");

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];
  if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];
  if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0002;
 const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

 const q=`[out:json][timeout:60];(`+
  `way["landuse"~"grass|forest|meadow|orchard|vineyard|greenfield"](${bbox});`+
  `way["leisure"~"garden|park|nature_reserve|recreation_ground"](${bbox});`+
  `way["natural"~"scrub|heath|grassland"](${bbox});`+
  `);out geom;`;

 let GREEN=[];
 for(const url of OVERPASS_URLS){
  try{
   const res=await fetch(url+"?data="+encodeURIComponent(q));
   if(!res.ok)continue;
   const json=await res.json();
   for(const el of (json.elements||[])){
    const rings=extractRings(el);
    if(rings)GREEN.push(...rings);
   }
   break;
  }catch(e){}
 }

 const lineIdx=buildNodeIndex(IMP_LINES);
 const stepLat=10/110540;
 const stepLon=10/(111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180));

 let nPark=0,nWater=0,nImp=0,nGreen=0,nOther=0;

 for(let la=minLat;la<=maxLat;la+=stepLat){
  for(let lo=minLon;lo<=maxLon;lo+=stepLon){
   if(!pointInPark(la,lo,PARK_POLY))continue;
   nPark++;
   if(pointInWater(la,lo)){nWater++;continue;}
   let imp=false;
   for(const r of IMP_RINGS){
    if(pointInPolygon(la,lo,r)){imp=true;break;}
   }
   if(!imp&&nearLineIndex(lineIdx,la,lo,5))imp=true;
   if(imp){nImp++;continue;}
   let gr=false;
   for(const r of GREEN){
    if(pointInPolygon(la,lo,r)){gr=true;break;}
   }
   if(gr){nGreen++;continue;}
   nOther++;
  }
 }

 const cellM2=100;
 const ha=v=>(v*cellM2/10000).toFixed(1);

 if(rep)rep.innerHTML=
  `<b>🌿 Arazi Örtüsü</b> (10m örneklem, sadece park içi)<br>`+
  `🟩 Yeşil: <b>${ha(nGreen)} ha</b> · 🟫 Sert: <b>${ha(nImp)} ha</b> · 🟦 Su: <b>${ha(nWater)} ha</b> · ⬜ Diğer: <b>${ha(nOther)} ha</b><br>`+
  `<span style="color:var(--mut)">Toplam park: ${ha(nPark)} ha</span>`;

 toast("✓ Arazi örtüsü analizi tamam","ok","🌿");
}

/* =========================================================
 * MODÜL 2: PARK RAPOR GÖRSELİ (PNG)
 * ========================================================= */

function downloadParkImage(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç","warn");

 const incGrid=($("chkPngGrid")?$("chkPngGrid").checked:true)&&GRID_CELLS.length>0;
 const incWp=($("chkPngWp")?$("chkPngWp").checked:true);
 const incCover=($("chkPngCover")?$("chkPngCover").checked:true);
 const wpRows=(LAST_WP_ROWS.length?LAST_WP_ROWS:WP).filter(w=>pointInPark(w.lat,w.lon,PARK_POLY));
 const showWp=incWp&&wpRows.length>0;

 const W=1600,H=1200;
 const canvas=document.createElement("canvas");
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext("2d");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,W,H);

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0004;
 minLat-=pad;maxLat+=pad;minLon-=pad;maxLon+=pad;
 const dLat=maxLat-minLat,dLon=maxLon-minLon;
 const scale=Math.min((W-140)/dLon,(H-200)/dLat);
 const ox=(W-dLon*scale)/2, oy=(H-dLat*scale)/2+30;
 const toXY=(lat,lon)=>[ox+(lon-minLon)*scale, oy+(maxLat-lat)*scale];

 if(incCover){
  IMP_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
   ctx.fillStyle="#9ca3af44";ctx.strokeStyle="#6b7280";ctx.lineWidth=1;
   ctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?ctx.moveTo(xy[0],xy[1]):ctx.lineTo(xy[0],xy[1]);});
   ctx.closePath();ctx.fill();ctx.stroke();
  });
  WATER_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
   ctx.fillStyle="#60a5fa88";ctx.strokeStyle="#2563eb";ctx.lineWidth=1.5;
   ctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?ctx.moveTo(xy[0],xy[1]):ctx.lineTo(xy[0],xy[1]);});
   ctx.closePath();ctx.fill();ctx.stroke();
  });
 }

 if(incGrid){
  const thresh=+$("gridThresh")?.value||3;
  GRID_CELLS.forEach(c=>{
   const a=toXY(c.s0,c.w0), b=toXY(c.s1,c.w1);
   const col=c.n===0?"#e11d48":(c.n<thresh?"#f59e0b":"#16a34a");
   ctx.fillStyle=col+"55";ctx.strokeStyle=col;ctx.lineWidth=1;
   ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
   ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
  });
 }

 ctx.strokeStyle="#2b6cb0";ctx.lineWidth=3;ctx.setLineDash([12,8]);
 PARK_POLY.forEach(r=>{
  ctx.beginPath();
  r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?ctx.moveTo(xy[0],xy[1]):ctx.lineTo(xy[0],xy[1]);});
  ctx.closePath();ctx.stroke();
 });
 ctx.setLineDash([]);

 if(showWp){
  wpRows.forEach(w=>{
   const xy=toXY(w.lat,w.lon);
   ctx.fillStyle="#e11d48";
   ctx.beginPath();ctx.arc(xy[0],xy[1],5,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();
  });
 }

 const name=(PARK_CANDS[0]&&PARK_CANDS[0].name)||"İsimsiz Park";
 const haTotal=(polyArea(PARK_POLY)/10000).toFixed(1);
 ctx.fillStyle="#14532d";ctx.fillRect(0,0,W,64);
 ctx.fillStyle="#ffffff";ctx.font="bold 24px system-ui";
 ctx.fillText("🌳 "+name+" — Saha Raporu",24,40);

 const lines=[
  "DendroGeo · Park Raporu",
  "Park: "+name,
  "Toplam alan: "+haTotal+" ha",
  incGrid?("Grid: "+GRID_CELLS.length+" hücre ("+($("gridSize")?.value||20)+"×"+($("gridSize")?.value||20)+" m)"):"Grid: dahil edilmedi",
  showWp?("Waypoint: "+wpRows.length):"Waypoint: dahil edilmedi",
  "Tarih: "+new Date().toLocaleDateString("tr-TR")
 ];
 const bw=340,bh=lines.length*24+20;
 ctx.fillStyle="rgba(255,255,255,.95)";
 ctx.strokeStyle="#94a3b8";ctx.lineWidth=1;
 ctx.fillRect(W-bw-24,H-bh-24,bw,bh);
 ctx.strokeRect(W-bw-24,H-bh-24,bw,bh);
 ctx.fillStyle="#1f2937";ctx.font="13px system-ui";
 lines.forEach((t,i)=>ctx.fillText(t,W-bw-8,H-bh-4+24*(i+1)));

 const lg=[];
 if(incGrid){lg.push(["#16a34a","Yeterli"],["#f59e0b","Az"],["#e11d48","Boş"]);}
 if(showWp)lg.push(["#e11d48","Waypoint"]);
 if(incCover){lg.push(["#60a5fa","Su"],["#9ca3af","Sert zemin"]);}
 lg.push(["#2b6cb0","Park sınırı"]);
 ctx.font="13px system-ui";
 lg.forEach((e,i)=>{
  const y=90+i*22;
  ctx.fillStyle=e[0];ctx.fillRect(W-190,y,16,14);
  ctx.strokeStyle="#333";ctx.strokeRect(W-190,y,16,14);
  ctx.fillStyle="#1f2937";ctx.fillText(e[1],W-168,y+12);
 });

 const mPerDeg=111320*Math.cos((minLat+maxLat)/2*Math.PI/180);
 const barPx=200*scale/mPerDeg;
 ctx.fillStyle="#1f2937";ctx.fillRect(24,H-36,barPx,8);
 ctx.font="bold 12px system-ui";
 ctx.fillText("200 m",24+barPx+8,H-28);

 canvas.toBlob(b=>{
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download="dendrogeo_"+name.replace(/[^a-z0-9_]/gi,"_")+"_rapor.png";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast("✓ Rapor PNG indirildi","ok","🖼️");
 },"image/png");
}
