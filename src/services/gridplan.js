"use strict";

/* =========================================================
 * DendroGeo v2 · gridplan.js
 *
 * PARK + GRID + GERÇEK GEOMETRİK FİLTRE
 *                 
 * Filtreler:                  
 *  - Park dışı
 *  - Göl / su            
 *  - Suya 15 m güvenlik mesafesi
 *  - Bina
 *  - Bina/yapıya 10 m güvenlik mesafesi
 *  - Yol
 *  - Yola 10 m güvenlik mesafesi
 *
 * ÖNEMLİ:
 * Eski sürümde hücre sadece merkez + 4 köşe ile kontrol
 * ediliyordu. Bu sürümde hücrenin tamamı geometrik olarak
 * kontrol edilir.
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

/* =========================================================
 * AYARLAR
 * ========================================================= */

const WATER_CLEARANCE_M=15;
const IMP_CLEARANCE_M=10;

const OVERPASS_URLS=[
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass.osm.ch/api/interpreter"
];

/* =========================================================
 * METRESEL PROJEKSİYON
 * ========================================================= */

function projectPoint(lat,lon,refLat){
 const kx=111320*Math.cos(refLat*Math.PI/180);
 const ky=110540;

 return {
  x:lon*kx,
  y:lat*ky
 };
}

/* =========================================================
 * BBOX
 * ========================================================= */

function ringBBox(ring,refLat){
 let minX=Infinity;
 let minY=Infinity;
 let maxX=-Infinity;
 let maxY=-Infinity;

 for(const p of ring){
  const q=projectPoint(p[0],p[1],refLat);

  if(q.x<minX)minX=q.x;
  if(q.y<minY)minY=q.y;
  if(q.x>maxX)maxX=q.x;
  if(q.y>maxY)maxY=q.y;
 }

 return {
  minX,
  minY,
  maxX,
  maxY
 };
}

function expandBBox(b,d){
 return {
  minX:b.minX-d,
  minY:b.minY-d,
  maxX:b.maxX+d,
  maxY:b.maxY+d
 };
}

function bboxesOverlap(a,b){
 return !(
  a.maxX<b.minX ||
  a.minX>b.maxX ||
  a.maxY<b.minY ||
  a.minY>b.maxY
 );
}

/* =========================================================
 * NOKTA POLYGON İÇİNDE Mİ?
 * ========================================================= */

function pointInPolygonXY(x,y,poly){
 let inside=false;

 for(
  let i=0,j=poly.length-1;
  i<poly.length;
  j=i++
 ){
  const xi=poly[i].x;
  const yi=poly[i].y;

  const xj=poly[j].x;
  const yj=poly[j].y;

  if(
   ((yi>y)!==(yj>y)) &&
   (
    x<
    (xj-xi)*(y-yi)/(yj-yi)+xi
   )
  ){
   inside=!inside;
  }
 }

 return inside;
}

function pointInPolygon(lat,lon,ring){
 if(!ring||ring.length<3)return false;

 const refLat=lat;

 const p=projectPoint(
  lat,
  lon,
  refLat
 );

 const poly=ring.map(q=>
  projectPoint(
   q[0],
   q[1],
   refLat
  )
 );

 return pointInPolygonXY(
  p.x,
  p.y,
  poly
 );
}

function pointInPark(lat,lon,rings){
 if(!rings||!rings.length)return false;

 return rings.some(
  r=>pointInPolygon(lat,lon,r)
 );
}

/* =========================================================
 * SEGMENT KESİŞİMİ
 * ========================================================= */

function orientation(a,b,c){
 const v=
  (b.x-a.x)*(c.y-a.y)-
  (b.y-a.y)*(c.x-a.x);

 if(Math.abs(v)<1e-9)return 0;

 return v>0?1:2;
}

function onSegment(a,b,p){
 return (
  p.x>=Math.min(a.x,b.x)-1e-9 &&
  p.x<=Math.max(a.x,b.x)+1e-9 &&
  p.y>=Math.min(a.y,b.y)-1e-9 &&
  p.y<=Math.max(a.y,b.y)+1e-9
 );
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
  {
   x:rect.minX,
   y:rect.minY
  },
  {
   x:rect.maxX,
   y:rect.minY
  },
  {
   x:rect.maxX,
   y:rect.maxY
  },
  {
   x:rect.minX,
   y:rect.maxY
  }
 ];
}

/* =========================================================
 * SEGMENT → RECTANGLE
 * ========================================================= */

function segmentIntersectsRect(a,b,rect){
 const cs=rectCorners(rect);

 for(let i=0;i<4;i++){
  if(
   segmentsIntersect(
    a,
    b,
    cs[i],
    cs[(i+1)%4]
   )
  ){
   return true;
  }
 }

 if(
  a.x>=rect.minX &&
  a.x<=rect.maxX &&
  a.y>=rect.minY &&
  a.y<=rect.maxY
 ){
  return true;
 }

 if(
  b.x>=rect.minX &&
  b.x<=rect.maxX &&
  b.y>=rect.minY &&
  b.y<=rect.maxY
 ){
  return true;
 }

 return false;
}

/* =========================================================
 * POLYGON → CELL
 *
 * Göl veya bina hücreye değiyorsa false.
 * ========================================================= */

function geometryIntersectsRect(
 points,
 rect,
 refLat,
 bufferM=0
){
 if(!points||points.length<2)return false;

 const pts=points.map(
  p=>projectPoint(
   p[0],
   p[1],
   refLat
  )
 );

 const gb=expandBBox(
  ringBBox(points,refLat),
  bufferM
 );

 const testRect=expandBBox(
  rect,
  bufferM
 );

 if(!bboxesOverlap(gb,testRect)){
  return false;
 }

 /* Polygon noktalarından biri hücrede */
 for(const p of pts){
  if(
   p.x>=testRect.minX &&
   p.x<=testRect.maxX &&
   p.y>=testRect.minY &&
   p.y<=testRect.maxY
  ){
   return true;
  }
 }

 /* Hücrenin köşelerinden biri polygon içinde */
 const corners=rectCorners(testRect);

 for(const c of corners){
  if(
   pointInPolygonXY(
    c.x,
    c.y,
    pts
   )
  ){
   return true;
  }
 }

 /* Polygon kenarlarından biri hücreyi kesiyor */
 for(let i=0;i<pts.length;i++){
  const a=pts[i];
  const b=pts[(i+1)%pts.length];

  if(
   segmentIntersectsRect(
    a,
    b,
    testRect
   )
  ){
   return true;
  }
 }

 return false;
}

/* =========================================================
 * ÇİZGİ → CELL
 *
 * Yol, nehir vb.
 * ========================================================= */

function geometryLineIntersectsRect(
 points,
 rect,
 refLat,
 bufferM=0
){
 if(!points||points.length<2)return false;

 const gb=expandBBox(
  ringBBox(points,refLat),
  bufferM
 );

 const testRect=expandBBox(
  rect,
  bufferM
 );

 if(!bboxesOverlap(gb,testRect)){
  return false;
 }

 const pts=points.map(
  p=>projectPoint(
   p[0],
   p[1],
   refLat
  )
 );

 for(let i=0;i<pts.length-1;i++){
  if(
   segmentIntersectsRect(
    pts[i],
    pts[i+1],
    testRect
   )
  ){
   return true;
  }
 }

 return false;
}

/* =========================================================
 * CELL PARK İÇİNDE Mİ?
 *
 * Hücrenin merkezinin parkta olması artık yeterli değil.
 * Hücre park sınırını kesiyorsa hücre iptal edilir.
 * ========================================================= */

function cellInsidePark(
 s0,
 s1,
 w0,
 w1
){
 const cLat=(s0+s1)/2;
 const cLon=(w0+w1)/2;

 const samples=[
  [s0,w0],
  [s0,w1],
  [s1,w1],
  [s1,w0],
  [cLat,cLon]
 ];

 for(const p of samples){
  if(
   !pointInPark(
    p[0],
    p[1],
    PARK_POLY
   )
  ){
   return false;
  }
 }

 const cell=[
  projectPoint(s0,w0,cLat),
  projectPoint(s0,w1,cLat),
  projectPoint(s1,w1,cLat),
  projectPoint(s1,w0,cLat)
 ];

 for(const ring of PARK_POLY){

  const poly=ring.map(
   p=>projectPoint(
    p[0],
    p[1],
    cLat
   )
  );

  for(let i=0;i<poly.length;i++){

   const a=poly[i];
   const b=poly[(i+1)%poly.length];

   for(let j=0;j<4;j++){

    if(
     segmentsIntersect(
      a,
      b,
      cell[j],
      cell[(j+1)%4]
     )
    ){
     return false;
    }

   }
  }
 }

 return true;
}

/* =========================================================
 * CELL GEÇERLİ Mİ?
 *
 * 1. Park
 * 2. Göl
 * 3. Su güvenlik mesafesi
 * 4. Bina
 * 5. Yol
 * 6. Güvenlik mesafeleri
 * ========================================================= */

function isCellValid(
 s0,
 s1,
 w0,
 w1
){

 /* Park dışı */
 if(
  !cellInsidePark(
   s0,
   s1,
   w0,
   w1
  )
 ){
  return false;
 }

 const cLat=(s0+s1)/2;

 const cellRect=ringBBox(
  [
   [s0,w0],
   [s0,w1],
   [s1,w1],
   [s1,w0]
  ],
  cLat
 );

 /* =====================================================
  * GÖLLER / SU
  * ===================================================== */

 for(const water of WATER_RINGS){

  if(
   geometryIntersectsRect(
    water,
    cellRect,
    cLat,
    WATER_CLEARANCE_M
   )
  ){
   return false;
  }
 }

 /* =====================================================
  * NEHİR / KANAL / SU ÇİZGİLERİ
  * ===================================================== */

 for(const line of WATER_LINES){

  if(
   geometryLineIntersectsRect(
    line,
    cellRect,
    cLat,
    WATER_CLEARANCE_M
   )
  ){
   return false;
  }
 }

 /* =====================================================
  * BİNALAR
  * ===================================================== */

 for(const building of IMP_RINGS){

  if(
   geometryIntersectsRect(
    building,
    cellRect,
    cLat,
    IMP_CLEARANCE_M
   )
  ){
   return false;
  }
 }

 /* =====================================================
  * YOLLAR / ÇİZGİLER
  * ===================================================== */

 for(const line of IMP_LINES){

  if(
   geometryLineIntersectsRect(
    line,
    cellRect,
    cLat,
    IMP_CLEARANCE_M
   )
  ){
   return false;
  }
 }

 return true;
}

/* =========================================================
 * OVERPASS
 * ========================================================= */

async function queryPark(
 lat,
 lon,
 radius=1200
){

 const q=
 `[out:json][timeout:25];(`+

 `way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:${radius},${lat},${lon});`+

 `way["landuse"~"forest|grass|meadow|recreation_ground"](around:${radius},${lat},${lon});`+

 `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+

 `way["natural"="water"](around:${radius},${lat},${lon});`+

 `way["waterway"~"riverbank|canal|dock|basin"](around:${radius},${lat},${lon});`+

 `relation["natural"="water"](around:${radius},${lat},${lon});`+

 `way["building"](around:${radius},${lat},${lon});`+

 `way["highway"~"residential|primary|secondary|tertiary|service|footway|path|cycleway|track|unclassified"](around:${radius},${lat},${lon});`+

 `way["landuse"~"commercial|industrial|retail|construction"](around:${radius},${lat},${lon});`+

 `);out geom;`;

 for(const url of OVERPASS_URLS){

  try{

   const res=
    await fetch(
     url+
     "?data="+
     encodeURIComponent(q)
    );

   if(!res.ok)continue;

   const json=
    await res.json();

   const cands=[];

   WATER_RINGS=[];
   WATER_LINES=[];

   IMP_RINGS=[];
   IMP_LINES=[];

   for(
    const el of
    (json.elements||[])
   ){

    /* SU */
    if(isWater(el)){
     collectWaterGeometry(el);
     continue;
    }

    /* BİNA / YOL */
    if(isImpervious(el)){
     collectImperviousGeometry(el);
     continue;
    }

    /* PARK */
    const rings=
     extractRings(el);

    if(
     !rings||
     !rings.length
    ){
     continue;
    }

    cands.push({
     rings,
     name:
      (el.tags&&el.tags.name)||
      null,
     area:
      polyArea(rings)
    });
   }

   if(!cands.length){
    continue;
   }

   const inside=
    cands.filter(
     c=>
      pointInPark(
       lat,
       lon,
       c.rings
      )
    );

   return (
    inside.length?
    inside:
    cands
   )
   .slice()
   .sort(
    (a,b)=>
     b.area-a.area
   );

  }catch(e){
   console.warn(
    "Overpass hata:",
    e
   );
  }
 }

 return null;
}

/* =========================================================
 * RING ÇIKAR
 * ========================================================= */

function extractRings(el){

 if(
  el.type==="way" &&
  el.geometry
 ){

  const r=
   el.geometry.map(
    g=>[
     g.lat,
     g.lon
    ]
   );

  return r.length>2?
   [r]:
   null;
 }

 if(
  el.type==="relation" &&
  el.members
 ){

  const outer=
   el.members
   .filter(
    m=>
     m.role==="outer" &&
     m.geometry
   )
   .map(
    m=>
     m.geometry.map(
      g=>[
       g.lat,
       g.lon
      ]
     )
   );

  if(!outer.length){
   return null;
  }

  return joinWaysToRings(
   outer
  );
 }

 return null;
}

/* =========================================================
 * SU MU?
 * ========================================================= */

function isWater(el){

 const t=el.tags||{};

 return (
  t.natural==="water" ||
  t.landuse==="reservoir" ||
  t.landuse==="basin" ||
  t.leisure==="swimming_pool" ||
  !!t.waterway
 );
}

/* =========================================================
 * KATI ZEMİN?
 * ========================================================= */

function isImpervious(el){

 const t=el.tags||{};

 return (
  !!t.building ||
  !!t.highway ||
  t.landuse==="commercial" ||
  t.landuse==="industrial" ||
  t.landuse==="retail" ||
  t.landuse==="construction"
 );
}

/* =========================================================
 * KAPALI ÇİZGİ
 * ========================================================= */

function isClosedLine(line){

 if(!line||line.length<3){
  return false;
 }

 return (
  Math.abs(
   line[0][0]-
   line[line.length-1][0]
  )<1e-9 &&
  Math.abs(
   line[0][1]-
   line[line.length-1][1]
  )<1e-9
 );
}

/* =========================================================
 * SU GEOMETRİSİ TOPLA
 * ========================================================= */

function collectWaterGeometry(el){

 if(el.type==="relation"){

  const rings=
   extractRings(el);

  if(rings){
   WATER_RINGS.push(
    ...rings
   );
  }

  return;
 }

 if(!el.geometry)return;

 const line=
  el.geometry.map(
   g=>[
    g.lat,
    g.lon
   ]
  );

 const t=el.tags||{};

 if(
  isClosedLine(line) &&
  (
   t.natural==="water" ||
   t.landuse==="reservoir" ||
   t.landuse==="basin" ||
   t.waterway==="riverbank"
  )
 ){

  WATER_RINGS.push(
   line
  );

 }else if(
  line.length>1
 ){

  WATER_LINES.push(
   line
  );
 }
}

/* =========================================================
 * BİNA / YOL GEOMETRİSİ TOPLA
 * ========================================================= */

function collectImperviousGeometry(el){

 if(el.type==="relation"){

  const rings=
   extractRings(el);

  if(rings){
   IMP_RINGS.push(
    ...rings
   );
  }

  return;
 }

 if(!el.geometry)return;

 const line=
  el.geometry.map(
   g=>[
    g.lat,
    g.lon
   ]
  );

 const t=el.tags||{};

 /* BİNA */
 if(t.building){

  if(
   isClosedLine(line)
  ){
   IMP_RINGS.push(
    line
   );
  }else{
   IMP_LINES.push(
    line
   );
  }

  return;
 }

 /* YOL */
 if(t.highway){

  IMP_LINES.push(
   line
  );

  return;
 }

 /* Diğer katı alanlar */
 if(t.landuse){

  if(
   isClosedLine(line)
  ){
   IMP_RINGS.push(
    line
   );
  }else{
   IMP_LINES.push(
    line
   );
  }

  return;
 }

 IMP_LINES.push(
  line
 );
}

/* =========================================================
 * WAY → RING BİRLEŞTİR
 * ========================================================= */

function joinWaysToRings(ways){

 const rings=[];
 const rem=ways.slice();

 const eq=(a,b)=>
  Math.abs(
   a[0]-b[0]
  )<1e-9 &&
  Math.abs(
   a[1]-b[1]
  )<1e-9;

 while(rem.length){

  const ch=
   rem.shift().slice();

  let m=true;

  let guard=
   ways.length*2+10;

  while(
   m&&
   guard-->0
  ){

   m=false;

   for(
    let i=0;
    i<rem.length;
    i++
   ){

    const w=rem[i];

    const h=ch[0];
    const t=ch[ch.length-1];

    if(eq(t,w[0])){

     ch.push(
      ...w.slice(1)
     );

     m=true;

    }else if(
     eq(
      t,
      w[w.length-1]
     )
    ){

     ch.push(
      ...w
      .slice()
      .reverse()
      .slice(1)
     );

     m=true;

    }else if(
     eq(
      h,
      w[w.length-1]
     )
    ){

     ch.unshift(
      ...w.slice(0,-1)
     );

     m=true;

    }else if(
     eq(
      h,
      w[0]
     )
    ){

     ch.unshift(
      ...w
      .slice()
      .reverse()
      .slice(0,-1)
     );

     m=true;
    }

    if(m){

     rem.splice(
      i,
      1
     );

     break;
    }
   }
  }

  if(ch.length>2){
   rings.push(
    ch
   );
  }
 }

 return rings;
}

/* =========================================================
 * ALAN HESAPLA
 * ========================================================= */

function polyArea(rings){

 let t=0;

 for(const ring of rings){

  if(
   !ring||
   ring.length<3
  ){
   continue;
  }

  const kx=
   111320*
   Math.cos(
    ring[0][0]*
    Math.PI/180
   );

  const ky=110540;

  let a=0;

  for(
   let i=0,j=ring.length-1;
   i<ring.length;
   j=i++
  ){

   a+=
    (
     ring[j][1]*kx
    )*
    (
     ring[i][0]*ky
    )
    -
    (
     ring[i][1]*kx
    )*
    (
     ring[j][0]*ky
    );
  }

  t+=
   Math.abs(a/2);
 }

 return t;
}

/* =========================================================
 * ESKİ API UYUMLULUK
 * ========================================================= */

function pointInWater(
 lat,
 lon
){
 return WATER_RINGS.some(
  r=>
   pointInPolygon(
    lat,
    lon,
    r
   )
 );
}

function nearWater(
 lat,
 lon
){

 const dLat=
  WATER_CLEARANCE_M/
  110540;

 const dLon=
  WATER_CLEARANCE_M/
  (
   111320*
   Math.max(
    .1,
    Math.cos(
     lat*
     Math.PI/180
    )
   )
  );

 const rect=
  ringBBox(
   [
    [lat-dLat,lon-dLon],
    [lat-dLat,lon+dLon],
    [lat+dLat,lon+dLon],
    [lat+dLat,lon-dLon]
   ],
   lat
  );

 return (
  WATER_RINGS.some(
   r=>
    geometryIntersectsRect(
     r,
     rect,
     lat,
     0
    )
  ) ||
  WATER_LINES.some(
   l=>
    geometryLineIntersectsRect(
     l,
     rect,
     lat,
     0
    )
  )
 );
}

function nearImpervious(
 lat,
 lon
){

 const dLat=
  IMP_CLEARANCE_M/
  110540;

 const dLon=
  IMP_CLEARANCE_M/
  (
   111320*
   Math.max(
    .1,
    Math.cos(
     lat*
     Math.PI/180
    )
   )
  );

 const rect=
  ringBBox(
   [
    [lat-dLat,lon-dLon],
    [lat-dLat,lon+dLon],
    [lat+dLat,lon+dLon],
    [lat+dLat,lon-dLon]
   ],
   lat
  );

 return (
  IMP_RINGS.some(
   r=>
    geometryIntersectsRect(
     r,
     rect,
     lat,
     0
    )
  ) ||
  IMP_LINES.some(
   l=>
    geometryLineIntersectsRect(
     l,
     rect,
     lat,
     0
    )
  )
 );
}

function isValidSpot(
 lat,
 lon
){
 return (
  !pointInWater(
   lat,
   lon
  ) &&
  !nearWater(
   lat,
   lon
  ) &&
  !nearImpervious(
   lat,
   lon
  )
 );
}

/* =========================================================
 * PARK MODU
 * ========================================================= */

function toggleParkMode(){

 PARK_MODE=!PARK_MODE;

 const b=
  $("parkModeBtn");

 b.textContent=
  "🌳 Park Analizi Modu: "+
  (
   PARK_MODE?
   "AÇIK":
   "KAPALI"
  );

 b.className=
  "btn sm "+
  (
   PARK_MODE?
   "":
   "blue"
  );

 $("parkModeHint").textContent=
  PARK_MODE?
  "Şimdi haritada bir parkın İÇİNE tıkla.":
  "Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";

 bindParkClick();

 if(!PARK_MODE){

  PARK_CANDS=[];

  clearPark();
 }
}

/* =========================================================
 * PARK CLICK
 * ========================================================= */

function bindParkClick(){

 if(
  PARK_CLICK_BOUND||
  !map
 ){
  return;
 }

 PARK_CLICK_BOUND=true;

 map.on(
  "click",
  async e=>{

   if(!PARK_MODE){
    return;
   }

   toast(
    "🌳 Park sınırı sorgulanıyor…",
    "info"
   );

   const parks=
    await queryPark(
     e.latlng.lat,
     e.latlng.lng
    );

   if(
    !parks||
    !parks.length
   ){

    return toast(
     "Park bulunamadı veya Overpass yoğun. 10 sn sonra tekrar dene.",
     "warn"
    );
   }

   PARK_CANDS=parks;

   drawPark(
    parks[0]
   );
  }
 );
}

/* =========================================================
 * PARK ÇİZ
 * ========================================================= */

function drawPark(park){

 clearPark();
 clearGrid();

 PARK_POLY=
  park.rings;

 PARK_LAYER=
  L.polygon(
   park.rings,
   {
    color:"#2b6cb0",
    weight:2.5,
    dashArray:"6,6",
    fillColor:"#3b82f6",
    fillOpacity:.10,
    interactive:false
   }
  ).addTo(map);

 /* GÖL */
 if(
  WATER_RINGS.length
 ){

  WATER_LAYER=
   L.layerGroup()
   .addTo(map);

  WATER_RINGS.forEach(
   ring=>{
    L.polygon(
     ring,
     {
      color:"#2563eb",
      weight:1,
      fillColor:"#60a5fa",
      fillOpacity:.4,
      interactive:false
     }
    ).addTo(
     WATER_LAYER
    );
   }
  );
 }

 /* SU ÇİZGİLERİ */
 if(
  WATER_LINES.length
 ){

  if(!WATER_LAYER){
   WATER_LAYER=
    L.layerGroup()
    .addTo(map);
  }

  WATER_LINES.forEach(
   line=>{
    L.polyline(
     line,
     {
      color:"#2563eb",
      weight:2,
      opacity:.5,
      interactive:false
     }
    ).addTo(
     WATER_LAYER
    );
   }
  );
 }

 /* BİNA / YOL */
 if(
  IMP_RINGS.length||
  IMP_LINES.length
 ){

  IMP_LAYER=
   L.layerGroup()
   .addTo(map);

  IMP_RINGS.forEach(
   ring=>{
    L.polygon(
     ring,
     {
      color:"#9ca3af",
      weight:.7,
      fillColor:"#9ca3af",
      fillOpacity:.18,
      interactive:false
     }
    ).addTo(
     IMP_LAYER
    );
   }
  );

  IMP_LINES.forEach(
   line=>{
    L.polyline(
     line,
     {
      color:"#9ca3af",
      weight:2,
      opacity:.45,
      interactive:false
     }
    ).addTo(
     IMP_LAYER
    );
   }
  );
 }

 map.fitBounds(
  PARK_LAYER.getBounds(),
  {
   padding:[
    30,
    30
   ]
  }
 );

 const totalArea=
  park.area/10000;

 const waterArea=
  WATER_RINGS.length?
  polyArea(WATER_RINGS):
  0;

 const landArea=
  Math.max(
   0,
   park.area-waterArea
  );

 const haLand=
  (
   landArea/10000
  ).toFixed(1);

 const haWater=
  (
   waterArea/10000
  ).toFixed(1);

 let sizeWarn="";

 if(totalArea>50){

  sizeWarn=
   `<div style="margin-top:6px;padding:8px;background:#fef3c7;border-radius:8px;font-size:.78rem;color:#92400e">`+
   `⚠️ Park alanı çok büyük (${totalArea.toFixed(1)} ha). Grid oluşturmak yerine manuel waypoint kullanmanız önerilir.`+
   `</div>`;
 }

 const alt=
  PARK_CANDS.length>1
  ?
  `<div style="margin-top:8px;font-size:.8rem">`+
  `🔁 Alan seç: `+
  `<select id="parkAlt" onchange="switchPark(+this.value)">`+
  PARK_CANDS.map(
   (c,i)=>
    `<option value="${i}"${c===park?" selected":""}>`+
    `${esc(c.name||"İsimsiz")} · `+
    `${((c.area-waterArea)/10000).toFixed(1)} ha`+
    `</option>`
  ).join("")+
  `</select></div>`
  :
  "";

 $("parkInfo").style.display=
  "block";

 $("parkInfo").innerHTML=
  `<b>🌳 ${esc(park.name||"İsimsiz Park")}</b> · `+
  `<b>Kara: ${haLand} ha</b>`+
  (
   haWater>0.1?
   " · Su: "+haWater+" ha":
   ""
  )+
  alt+
  sizeWarn+

  `<div style="font-size:.75rem;color:var(--mut);margin-top:4px">`+
  `🔒 Filtre: göl/su ${WATER_CLEARANCE_M}m · bina/yol ${IMP_CLEARANCE_M}m · tam hücre geometrik kontrol`+
  `</div>`+

  `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+

  `<label style="font-size:.8rem">Proje:</label>`+

  `<select id="gridProject">`+
  (
   typeof PROJ_LIST!=="undefined"&&
   PROJ_LIST.length
  ?
   PROJ_LIST.map(
    p=>
     `<option value="${p.id}">`+
     `${esc(p.name)}`+
     `</option>`
   ).join("")
  :
   `<option value="0">Önce proje oluştur</option>`
  )+
  `</select>`+

  `<label style="font-size:.8rem">Grid:</label>`+

  `<select id="gridSize">`+
  `<option value="10">10×10 m</option>`+
  `<option value="20" selected>20×20 m</option>`+
  `<option value="50">50×50 m</option>`+
  `</select>`+

  `<label style="font-size:.8rem">Yeterli eşik:</label>`+

  `<select id="gridThresh">`+
  `<option value="1">1+</option>`+
  `<option value="2">2+</option>`+
  `<option value="3" selected>3+</option>`+
  `<option value="5">5+</option>`+
  `</select>`+

  `</div>`+

  `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`+

  `<button class="btn sm blue" onclick="buildGrid()">`+
  `🔲 Grid Oluştur`+
  `</button>`+

  `<button class="btn sm" id="gridVisBtn" onclick="toggleGridVis()">`+
  `🔲 Grid: GÖRÜNÜR`+
  `</button>`+

  `<button class="btn sm" id="wpVisBtn" onclick="toggleWpVis()">`+
  `📍 Waypoint: GÖRÜNÜR`+
  `</button>`+

  `<button class="btn sm" onclick="clearGrid()">`+
  `✕ Temizle`+
  `</button>`+

  `</div>`+

  `<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>`;

 toast(
  "✓ Park algılandı: "+
  haLand+
  " ha kara"+
  (
   haWater>0.1?
   " + "+
   haWater+
   " ha su":
   ""
  ),
  "ok",
  "🌳"
 );
}

/* =========================================================
 * PARK TEMİZLE
 * ========================================================= */

function clearPark(){

 if(
  PARK_LAYER&&
  map
 ){
  map.removeLayer(
   PARK_LAYER
  );

  PARK_LAYER=null;
 }

 if(
  WATER_LAYER&&
  map
 ){
  map.removeLayer(
   WATER_LAYER
  );

  WATER_LAYER=null;
 }

 if(
  IMP_LAYER&&
  map
 ){
  map.removeLayer(
   IMP_LAYER
  );

  IMP_LAYER=null;
 }

 WATER_RINGS=[];
 WATER_LINES=[];

 IMP_RINGS=[];
 IMP_LINES=[];

 PARK_POLY=null;
}

/* =========================================================
 * PARK DEĞİŞTİR
 * ========================================================= */

function switchPark(i){

 const p=
  PARK_CANDS[i];

 if(p){
  drawPark(p);
 }
}

/* =========================================================
 * GRID OLUŞTUR
 * ========================================================= */

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

 const thresh=
  +$("gridThresh").value||
  3;

 const est=
  Math.round(
   polyArea(PARK_POLY)/
   (size*size)
  );

 if(est>3000){

  return toast(
   "⚠ ~"+
   est+
   " hücre çok yoğun. 50×50 m seç.",
   "err"
  );
 }

 if(
  est>800&&
  !confirm(
   `⚠ ~${est} hücre oluşturulacak.\nDevam?`
  )
 ){
  return;
 }

 clearGrid();

 let minLat=90;
 let maxLat=-90;
 let minLon=180;
 let maxLon=-180;

 PARK_POLY.forEach(
  r=>
   r.forEach(
    p=>{
     if(p[0]<minLat)
      minLat=p[0];

     if(p[0]>maxLat)
      maxLat=p[0];

     if(p[1]<minLon)
      minLon=p[1];

     if(p[1]>maxLon)
      maxLon=p[1];
    }
   )
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

 for(
  let rI=0;;
  rI++
 ){

  const s0=
   minLat+
   rI*dLat;

  const s1=
   s0+dLat;

  if(
   s0>=maxLat
  ){
   break;
  }

  for(
   let cI=0;;
   cI++
  ){

   const w0=
    minLon+
    cI*dLon;

   const w1=
    w0+dLon;

   if(
    w0>=maxLon
   ){
    break;
   }

   /* GERÇEK GEOMETRİK FİLTRE */
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
    id:
     rI+
     "_"+
     cI
   };

   cellMap[
    cell.id
   ]=cell;

   GRID_CELLS.push(
    cell
   );
  }
 }

 /* =====================================================
  * ÖLÇÜMLER
  * ===================================================== */

 const{
  data
 }=
 await sb
  .from("measurements")
  .select("lat,lon")
  .eq(
   "status",
   "Onaylı"
  )
  .gte(
   "lat",
   minLat
  )
  .lte(
   "lat",
   maxLat
  )
  .gte(
   "lon",
   minLon
  )
  .lte(
   "lon",
   maxLon
  )
  .limit(5000);

 (data||[]).forEach(
  m=>{

   const key=
    Math.floor(
     (m.lat-minLat)/
     dLat
    )+
    "_"+
    Math.floor(
     (m.lon-minLon)/
     dLon
    );

   const cell=
    cellMap[key];

   if(cell){
    cell.n++;
   }
  }
 );

 SELECTED_CELLS.clear();

 drawGridLayer();

 toast(
  "✓ Güvenli grid hazır: "+
  GRID_CELLS.length+
  " hücre",
  "ok",
  "🔲"
 );
}

/* =========================================================
 * GRID ÇİZ
 * ========================================================= */

function drawGridLayer(){

 if(
  GRID_LAYER&&
  map
 ){
  map.removeLayer(
   GRID_LAYER
  );
 }

 GRID_LAYER=
  L.layerGroup()
  .addTo(map);

 const thresh=
  +$("gridThresh")?.value||
  3;

 let g=0;
 let y=0;
 let r0=0;

 GRID_CELLS.forEach(
  cell=>{

   const col=
    cell.n===0?
    "#e11d48":
    cell.n<thresh?
    "#f59e0b":
    "#16a34a";

   if(
    cell.n===0
   ){
    r0++;
   }else if(
    cell.n<thresh
   ){
    y++;
   }else{
    g++;
   }

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
       isSel?
       "#1d4ed8":
       col,

      weight:
       isSel?
       3:
       1.2,

      fillColor:
       isSel?
       "#3b82f6":
       col,

      fillOpacity:
       isSel?
       .55:
       .32,

      interactive:true
     }
    )
    .addTo(
     GRID_LAYER
    );

   /* ÖNEMLİ:
    * Hücre ID'sini rectangle üzerine yaz.
    */
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
    `Hücre ${cell.id} · ${cell.n} ölçüm · Tıkla: seç/kaldır`,
    {
     sticky:true
    }
   );
  }
 );

 updateGridSummary(
  g,
  y,
  r0
 );
}

/* =========================================================
 * GRID ÖZET
 * ========================================================= */

function updateGridSummary(
 g,
 y,
 r0
){

 const thresh=
  +$("gridThresh")?.value||
  3;

 const tot=
  GRID_CELLS.length;

 const pct=
  v=>
   tot?
   Math.round(
    v/tot*100
   ):
   0;

 const selCount=
  SELECTED_CELLS.size;

 $("gridSummary").innerHTML=
  `<b>📊 Park Analizi</b> · `+
  `Grid ${$("gridSize")?.value||20}×${$("gridSize")?.value||20} m<br>`+

  `Toplam hücre: <b>${tot}</b><br>`+

  `<span style="color:#16a34a">`+
  `🟢 Yeterli (${thresh}+): ${g} (%${pct(g)})`+
  `</span> · `+

  `<span style="color:#b45309">`+
  `🟡 Az: ${y} (%${pct(y)})`+
  `</span> · `+

  `<span style="color:#e11d48">`+
  `🔴 Boş: ${r0} (%${pct(r0)})`+
  `</span><br>`+

  (
   selCount>0?
   `<b style="color:#1d4ed8">`+
   `🔵 Seçili: ${selCount} hücre`+
   `</b><br>`:
   ""
  )+

  `💡 Hücrelere tıklayarak manuel seçim yapabilirsiniz.<br>`+

  `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+

  (
   r0>0?
   `<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">`+
   `📍 Otomatik (${r0} boş)`+
   `</button>`:
   ""
  )+

  (
   selCount>0?
   `<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">`+
   `📍 Seçili (${selCount})`+
   `</button>`:
   ""
  )+

  (
   selCount>0?
   `<button class="btn sm ghost" onclick="clearCellSelection()">`+
   `✕ Seçimi Temizle`+
   `</button>`:
   ""
  )+

  `</div>`;
}

/* =========================================================
 * CELL SEÇ
 * ========================================================= */

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

   const thresh=
    +$("gridThresh")?.value||
    3;

   const col=
    cell.n===0?
    "#e11d48":
    cell.n<thresh?
    "#f59e0b":
    "#16a34a";

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
 let y=0;
 let r0=0;

 const thresh=
  +$("gridThresh")?.value||
  3;

 GRID_CELLS.forEach(
  c=>{

   if(c.n===0){
    r0++;
   }else if(
    c.n<thresh
   ){
    y++;
   }else{
    g++;
   }
  }
 );

 updateGridSummary(
  g,
  y,
  r0
 );
}

/* =========================================================
 * SEÇİMİ TEMİZLE
 * ========================================================= */

function clearCellSelection(){

 SELECTED_CELLS.clear();

 if(GRID_LAYER){

  const thresh=
   +$("gridThresh")?.value||
   3;

  GRID_LAYER.eachLayer(
   l=>{

    if(
     l.setStyle&&
     l._cellId
    ){

     const cellId=
      l._cellId;

     const cell=
      GRID_CELLS.find(
       c=>c.id===cellId
      );

     if(cell){

      const col=
       cell.n===0?
       "#e11d48":
       cell.n<thresh?
       "#f59e0b":
       "#16a34a";

      l.setStyle({
       color:col,
       weight:1.2,
       fillColor:col,
       fillOpacity:.32
      });
     }
    }
   }
  );
 }

 let g=0;
 let y=0;
 let r0=0;

 const thresh=
  +$("gridThresh")?.value||
  3;

 GRID_CELLS.forEach(
  c=>{

   if(c.n===0){
    r0++;
   }else if(
    c.n<thresh
   ){
    y++;
   }else{
    g++;
   }
  }
 );

 updateGridSummary(
  g,
  y,
  r0
 );
}

/* =========================================================
 * GRID TEMİZLE
 * ========================================================= */

function clearGrid(){

 if(
  GRID_LAYER&&
  map
 ){
  map.removeLayer(
   GRID_LAYER
  );

  GRID_LAYER=null;
 }

 if(
  WP_AUTO_LAYER&&
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
 }
}

/* =========================================================
 * GRID GÖRÜNÜRLÜK
 * ========================================================= */

function toggleGridVis(){

 if(!GRID_LAYER)return;

 if(
  map.hasLayer(
   GRID_LAYER
  )
 ){

  map.removeLayer(
   GRID_LAYER
  );

  $("gridVisBtn").textContent=
   "🔲 Grid: GİZLİ";

 }else{

  map.addLayer(
   GRID_LAYER
  );

  $("gridVisBtn").textContent=
   "🔲 Grid: GÖRÜNÜR";
 }
}

/* =========================================================
 * WAYPOINT GÖRÜNÜRLÜK
 * ========================================================= */

function toggleWpVis(){

 if(!WP_AUTO_LAYER)return;

 if(
  map.hasLayer(
   WP_AUTO_LAYER
  )
 ){

  map.removeLayer(
   WP_AUTO_LAYER
  );

  $("wpVisBtn").textContent=
   "📍 Waypoint: GİZLİ";

 }else{

  map.addLayer(
   WP_AUTO_LAYER
  );

  $("wpVisBtn").textContent=
   "📍 Waypoint: GÖRÜNÜR";
 }
}

/* =========================================================
 * GRID → WAYPOINT
 * ========================================================= */

async function createWaypointsFromGrid(
 mode
){

 if(!GRID_CELLS.length){

  return toast(
   "Önce grid oluştur",
   "warn"
  );
 }

 const pid=
  +$("gridProject").value||
  0;

 if(!pid){

  return toast(
   "Önce proje seç veya oluştur",
   "warn"
  );
 }

 let targetCells=[];

 /* =====================================================
  * MANUEL
  *
  * Kullanıcı hücreyi kendisi seçti.
  * ===================================================== */

 if(mode==="manual"){

  if(
   !SELECTED_CELLS.size
  ){

   return toast(
    "Önce hücre seçin",
    "warn"
   );
  }

  targetCells=
   GRID_CELLS.filter(
    c=>
     SELECTED_CELLS.has(
      c.id
     )
   );

 }else{

  /* ===================================================
   * OTOMATİK
   *
   * Sadece ölçümü 0 olan güvenli hücreler.
   * =================================================== */

  targetCells=
   GRID_CELLS.filter(
    c=>c.n===0
   );
 }

 if(
  !targetCells.length
 ){

  return toast(
   "Uygun hücre yok",
   "warn"
  );
 }

 if(
  targetCells.length>500&&
  !confirm(
   targetCells.length+
   " waypoint oluşturulacak.\nDevam?"
  )
 ){
  return;
 }

 const{
  data:mx
 }=
 await sb
  .from("waypoints")
  .select("wp_id")
  .eq(
   "project_id",
   pid
  )
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
   mx.length?
   mx[0].wp_id:
   0
  )+
  1;

 const first=
  next;

 const rows=
  targetCells.map(
   c=>({

    owner:
     USER.id,

    project_id:
     pid,

    wp_id:
     next++,

    lat:
     +c.lat.toFixed(6),

    lon:
     +c.lon.toFixed(6),

    visited:
     false
   })
  );

 const{
  error
 }=
 await sb
  .from("waypoints")
  .insert(
   rows
  );

 if(error){

  return toast(
   "Hata: "+
   error.message,
   "err"
  );
 }

 if(
  WP_AUTO_LAYER&&
  map
 ){
  map.removeLayer(
   WP_AUTO_LAYER
  );
 }

 WP_AUTO_LAYER=
  L.layerGroup()
  .addTo(map);

 rows.forEach(
  r=>
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
  " waypoint oluşturuldu (P"+
  first+
  "–P"+
  (next-1)+
  ")",
  "ok",
  "📍"
 );

 clearCellSelection();
}
