"use strict";
/* DendroGeo v2 · gridplan.js v111 — FINAL (su+sert iyileştirmeleri) */           
  
let PARK_POLY=null;
let PARK_HOLES=[]; 
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

let GRID_BLOCK_LINES=[];

const GRID_CELLS=[];
let GRID_LAYER=null;
let WP_AUTO_LAYER=null;

const SELECTED_CELLS=new Set();

let LAST_WP_ROWS=[];
let PARK_REF_HA=null;
let PARK_SELECTED_AREA_M2=null;
let LANDCOVER=null;
let LANDCOVER_SAMPLES=[];
let SATELLITE_LAYER=null;
let SATELLITE_RUNNING=false;
let DG_PARK_PIXEL_GEOMETRY=null;

/* Reference-area helpers are intentionally local to the active gridplan module.
 * gridplan_core.js is an older parallel implementation and is not loaded by index.html. */
function setRefHa(v){
  const n=parseFloat(v);
  PARK_REF_HA=Number.isFinite(n)&&n>0?n:null;
  renderRefBadge();
}

function renderRefBadge(){
  const el=$("refBadge");
  if(!el) return;
  if(!(PARK_REF_HA>0) || !PARK_POLY){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const ha=parkAreaHa();
  if(!(ha>0)){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const dev=Math.abs(((ha-PARK_REF_HA)/PARK_REF_HA)*100);
  el.style.display="inline-flex";
  el.textContent="Referans: "+PARK_REF_HA.toFixed(2)+" ha · Sapma: %"+dev.toFixed(1);
  el.style.background=dev<3?"rgba(22,163,74,.12)":"rgba(245,158,11,.14)";
  el.style.color=dev<3?"#16a34a":"#b45309";
}

const WATER_CLEARANCE_M=1;
const IMP_CLEARANCE_M=1;

const OVERPASS_URLS=[
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

const OVERPASS_CACHE=new Map();
const OVERPASS_HEALTH=new Map();
let OVERPASS_BUSY=Promise.resolve();
let LAST_OVERPASS_ERROR=null;

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function overpassCacheKey(query){
  return query.replace(/\s+/g," ").trim();
}

async function overpassRequest(query,label="OSM"){
  const key=overpassCacheKey(query);
  const cached=OVERPASS_CACHE.get(key);

  if(cached && (Date.now()-cached.time)<10*60*1000){
    console.log("✓ Overpass cache:",label);
    return cached.data;
  }

  let release;
  const previous=OVERPASS_BUSY;
  OVERPASS_BUSY=new Promise(resolve=>{release=resolve;});
  await previous;

  try{
    const now=Date.now();
    const ordered=OVERPASS_URLS
      .map((url,index)=>{
        const h=OVERPASS_HEALTH.get(url)||{};
        return {url,index,badUntil:h.badUntil||0,lastOk:h.lastOk||0};
      })
      .filter(x=>x.badUntil<=now)
      .sort((x,y)=>{
        if(x.lastOk!==y.lastOk)return y.lastOk-x.lastOk;
        return x.index-y.index;
      });

    const pool=ordered.length
      ? ordered
      : OVERPASS_URLS.map((url,index)=>({url,index,badUntil:0,lastOk:0}));

    for(const item of pool){
      const controller=new AbortController();
      const timeoutMs=label==="park" ? 6500 : 18000;
      const timer=setTimeout(()=>controller.abort(),timeoutMs);

      try{
        console.log("→ Overpass:",label,item.url);

        const res=await fetch(item.url,{
          method:"POST",
          headers:{
            "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
            "Accept":"application/json"
          },
          body:"data="+encodeURIComponent(query),
          signal:controller.signal,
          cache:"no-store"
        });

        clearTimeout(timer);

        if(res.ok){
          const data=await res.json();
          if(data && Array.isArray(data.elements)){
            OVERPASS_CACHE.set(key,{time:Date.now(),data});
            OVERPASS_HEALTH.set(item.url,{lastOk:Date.now(),badUntil:0});
            LAST_OVERPASS_ERROR=null;
            console.log("✓ Overpass:",label,item.url,data.elements.length);
            return data;
          }
        }

        const status=res.status;
        if(status===429){
          OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
          console.warn("Overpass 429:",item.url,"→ 30 sn karantina");
          continue;
        }

        if(status===408||status===425||status>=500){
          OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
          console.warn("Overpass",status,item.url,"→ 60 sn karantina");
          continue;
        }

        const body=await res.text().catch(()=> "");
        LAST_OVERPASS_ERROR=label+" HTTP "+status+" "+body.slice(0,180);
        OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+30000});
        console.warn("Overpass hata:",LAST_OVERPASS_ERROR);
      }catch(err){
        clearTimeout(timer);
        const msg=err?.name==="AbortError" ? `timeout (${timeoutMs/1000}s)` : (err?.message||String(err));
        LAST_OVERPASS_ERROR=label+" "+msg;
        OVERPASS_HEALTH.set(item.url,{lastOk:item.lastOk,badUntil:Date.now()+60000});
        console.warn("Overpass bağlantı:",item.url,msg,"→ 60 sn karantina");
      }
    }
  }finally{
    release();
  }

  return null;
}


/* =========================================================
   AREA
========================================================= */

function ringGeodesicArea(ring){
  const R=6378137;
  let t=0;

  for(let i=0;i<ring.length;i++){
    const p1=ring[i];
    const p2=ring[(i+1)%ring.length];

    const l1=p1[1]*Math.PI/180;
    const l2=p2[1]*Math.PI/180;

    const f1=p1[0]*Math.PI/180;
    const f2=p2[0]*Math.PI/180;

    t+=(l2-l1)*(2+Math.sin(f1)+Math.sin(f2));
  }

  return Math.abs(t*R*R/2);
}

function polyArea(rings){
  if(!rings)return 0;

  if(!Array.isArray(rings) && rings.outer){
    let outerArea=0;
    let innerArea=0;

    for(const ring of rings.outer){
      if(ring&&ring.length>=3){
        outerArea+=ringGeodesicArea(ring);
      }
    }

    for(const ring of (rings.inner||[])){
      if(ring&&ring.length>=3){
        innerArea+=ringGeodesicArea(ring);
      }
    }

    return Math.max(0,outerArea-innerArea);
  }

  let total=0;

  for(const ring of rings){
    if(!ring||ring.length<3)continue;
    total+=ringGeodesicArea(ring);
  }

  return total;
}

function parkAreaM2(){
  if(Number.isFinite(PARK_SELECTED_AREA_M2) && PARK_SELECTED_AREA_M2>0){
    return PARK_SELECTED_AREA_M2;
  }
  if(!PARK_POLY)return 0;

  return polyArea({
    outer:PARK_POLY,
    inner:PARK_HOLES
  });
}

function parkAreaHa(){
  return parkAreaM2()/10000;
}


/* =========================================================
   GEOMETRY
========================================================= */

function projectPoint(lat,lon,refLat){
  return {
    x:lon*111320*Math.cos(refLat*Math.PI/180),
    y:lat*110540
  };
}

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

function expandBBox(x,d){
  return {
    minX:x.minX-d,
    minY:x.minY-d,
    maxX:x.maxX+d,
    maxY:x.maxY+d
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

  const p=projectPoint(lat,lon,lat);

  const poly=ring.map(q=>
    projectPoint(q[0],q[1],lat)
  );

  return pointInPolygonXY(
    p.x,
    p.y,
    poly
  );
}

function pointInPark(lat,lon,rings){
  if(!rings)return false;

  if(Array.isArray(rings)){
    if(!rings.length)return false;

    const insideOuter=rings.some(r=>
      pointInPolygon(lat,lon,r)
    );

    if(!insideOuter)return false;

    const insideHole=PARK_HOLES.some(r=>
      pointInPolygon(lat,lon,r)
    );

    return !insideHole;
  }

  if(rings.outer){
    const insideOuter=rings.outer.some(r=>
      pointInPolygon(lat,lon,r)
    );

    if(!insideOuter)return false;

    const insideHole=(rings.inner||[]).some(r=>
      pointInPolygon(lat,lon,r)
    );

    return !insideHole;
  }

  return false;
}


/* =========================================================
   SEGMENT / RECT
========================================================= */

function orientation(a,b,c){
  const v=
    (b.x-a.x)*(c.y-a.y)-
    (b.y-a.y)*(c.x-a.x);

  if(Math.abs(v)<1e-9)return 0;

  return v>0?1:2;
}

function onSegment(a,b,p){
  return(
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

function rectCorners(r){
  return[
    {x:r.minX,y:r.minY},
    {x:r.maxX,y:r.minY},
    {x:r.maxX,y:r.maxY},
    {x:r.minX,y:r.maxY}
  ];
}

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

function geometryIntersectsRect(
  points,
  rect,
  refLat,
  bufferM=0
){
  if(!points||points.length<2)return false;

  const pts=points.map(p=>
    projectPoint(
      p[0],
      p[1],
      refLat
    )
  );

  const sourceBox=expandBBox(
    ringBBox(points,refLat),
    bufferM
  );

  const testRect=expandBBox(
    rect,
    bufferM
  );

  if(!bboxesOverlap(sourceBox,testRect)){
    return false;
  }

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

  for(const c of rectCorners(testRect)){
    if(pointInPolygonXY(c.x,c.y,pts)){
      return true;
    }
  }

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

function geometryLineIntersectsRect(
  points,
  rect,
  refLat,
  bufferM=0
){
  if(!points||points.length<2)return false;

  const sourceBox=expandBBox(
    ringBBox(points,refLat),
    bufferM
  );

  const testRect=expandBBox(
    rect,
    bufferM
  );

  if(!bboxesOverlap(sourceBox,testRect)){
    return false;
  }

  const pts=points.map(p=>
    projectPoint(
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
   PARK / GRID
========================================================= */

function cellInsidePark(
  s0,
  s1,
  w0,
  w1
){
  const cLat=(s0+s1)/2;
  const cLon=(w0+w1)/2;

  const corners=[
    [s0,w0],
    [s0,w1],
    [s1,w1],
    [s1,w0]
  ];

  if(!pointInPark(cLat,cLon,PARK_POLY))return false;

  for(const p of corners){
    if(!pointInPark(p[0],p[1],PARK_POLY))return false;
  }

  const rect=ringBBox(corners,cLat);

  /*
   * Conservative boundary rule: no park outer boundary segment may
   * cross the cell. This prevents cells crossing concave indentations.
   */
  for(const ring of (PARK_POLY||[])){
    if(!ring||ring.length<2)continue;

    const pts=ring.map(p=>projectPoint(p[0],p[1],cLat));

    for(let i=0;i<pts.length-1;i++){
      if(segmentIntersectsRect(pts[i],pts[i+1],rect))return false;
    }
  }

  for(const ring of (PARK_HOLES||[])){
    if(!ring||ring.length<3)continue;

    const rb=ringBBox(ring,cLat);
    if(!bboxesOverlap(rb,rect))continue;

    for(const p of ring){
      const q=projectPoint(p[0],p[1],cLat);

      if(
        q.x>=rect.minX&&q.x<=rect.maxX&&
        q.y>=rect.minY&&q.y<=rect.maxY
      ){
        return false;
      }
    }

    const center=ring.reduce(
      (a,p)=>[
        a[0]+p[0]/ring.length,
        a[1]+p[1]/ring.length
      ],
      [0,0]
    );

    if(pointInPolygon(center[0],center[1],ring))return false;
  }

  return true;
}


function pointToSegmentDistanceM(lat,lon,a,b){
  const refLat=lat*Math.PI/180;
  const ax=(a[1]-lon)*111320*Math.cos(refLat);
  const ay=(a[0]-lat)*110540;
  const bx=(b[1]-lon)*111320*Math.cos(refLat);
  const by=(b[0]-lat)*110540;
  const dx=bx-ax;
  const dy=by-ay;

  if(dx===0&&dy===0){
    return Math.sqrt(ax*ax+ay*ay);
  }

  const denom=dx*dx+dy*dy;
  const t=Math.max(
    0,
    Math.min(
      1,
      (-ax*dx-ay*dy)/denom
    )
  );

  const px=ax+t*dx;
  const py=ay+t*dy;

  return Math.sqrt(px*px+py*py);
}

function pointNearImperviousLine(lat,lon,lines){
  for(const line of (lines||[])){
    if(!line||!Array.isArray(line.pts)||line.pts.length<2)continue;

    const width=Number.isFinite(Number(line.w))
      ?Math.max(0,Number(line.w))
      :1;

    for(let i=0;i<line.pts.length-1;i++){
      if(
        pointToSegmentDistanceM(
          lat,
          lon,
          line.pts[i],
          line.pts[i+1]
        )<=width
      ){
        return true;
      }
    }
  }

  return false;
}

/* =========================================================
   OSM 10 m CROSS-CHECK
========================================================= */

function pointNearAnyLine(lat,lon,lines,maxDistanceM){
  for(const line of (lines||[])){
    if(!Array.isArray(line)||line.length<2)continue;

    for(let i=0;i<line.length-1;i++){
      if(
        pointToSegmentDistanceM(
          lat,
          lon,
          line[i],
          line[i+1]
        )<=maxDistanceM
      ){
        return true;
      }
    }
  }

  return false;
}

function osmSampleGroup(lat,lon){
  for(const r of (WATER_RINGS||[])){
    if(pointInPolygon(lat,lon,r))return "water";
  }

  if(pointNearAnyLine(lat,lon,WATER_LINES,1))return "water";

  for(const r of (IMP_RINGS||[])){
    if(pointInPolygon(lat,lon,r))return "hard";
  }
  if(pointNearImperviousLine(lat,lon,IMP_LINES)){
    return "hard";
  }

  if(pointNearAnyLine(lat,lon,GRID_BLOCK_LINES,1))return "hard";

  return "open";
}

/* =========================================================
   GRID CELL VALIDATION
========================================================= */

function satelliteGroupForCell(s0,s1,w0,w1){
  if(!Array.isArray(LANDCOVER_SAMPLES)||!LANDCOVER_SAMPLES.length){
    return null;
  }

  const counts={
    green:0,
    hard:0,
    water:0,
    other:0
  };

  let total=0;

  for(const p of LANDCOVER_SAMPLES){
    if(
      p.lat>=s0&&
      p.lat<=s1&&
      p.lon>=w0&&
      p.lon<=w1
    ){
      const g=p.group||"other";
      if(Object.prototype.hasOwnProperty.call(counts,g)){
        counts[g]++;
      }
      total++;
    }
  }

  if(!total)return null;

  let dominant="other";
  let best=-1;

  for(const g of Object.keys(counts)){
    if(counts[g]>best){
      best=counts[g];
      dominant=g;
    }
  }

  return{
    dominant,
    counts,
    total,
    greenRatio:counts.green/total,
    hardRatio:counts.hard/total,
    waterRatio:counts.water/total,
    otherRatio:counts.other/total
  };
}

/* =========================================================
   GRID CELL VALIDATION
========================================================= */

function isCellValid(
  s0,
  s1,
  w0,
  w1
){
  if(!cellInsidePark(s0,s1,w0,w1))return false;

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

  for(const w of (WATER_RINGS||[])){
    if(
      geometryIntersectsRect(
        w,
        cellRect,
        cLat,
        WATER_CLEARANCE_M
      )
    )return false;
  }

  for(const l of (WATER_LINES||[])){
    if(
      geometryLineIntersectsRect(
        l,
        cellRect,
        cLat,
        WATER_CLEARANCE_M
      )
    )return false;
  }

  for(const b of (IMP_RINGS||[])){
    if(
      geometryIntersectsRect(
        b,
        cellRect,
        cLat,
        IMP_CLEARANCE_M
      )
    )return false;
  }

  /*
   * Linear impervious features were previously collected but skipped by
   * the grid validator. Their stored half-width is now respected.
   */
  for(const l of (IMP_LINES||[])){
    if(!l||!Array.isArray(l.pts)||l.pts.length<2)continue;

    const buffer=Number.isFinite(l.w)
      ?Math.max(0,l.w)
      :IMP_CLEARANCE_M;

    if(
      geometryLineIntersectsRect(
        l.pts,
        cellRect,
        cLat,
        buffer
      )
    )return false;
  }

  for(const l of (GRID_BLOCK_LINES||[])){
    if(
      geometryLineIntersectsRect(
        l,
        cellRect,
        cLat,
        IMP_CLEARANCE_M
      )
    )return false;
  }

  return true;
}

/* =========================================================
   PARK QUERY
========================================================= */

async function queryPark(
  lat,
  lon,
  radius=1200
){
  const q1=
    `[out:json][timeout:35];(`+
    `way["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
    `relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:${radius},${lat},${lon});`+
    `);`+
    `out geom;`;

  const parkData=await overpassRequest(q1,"park");

  if(
    !parkData||
    !parkData.elements||
    !parkData.elements.length
  ){
    console.warn(
      "Park sorgusu başarısız.",
      LAST_OVERPASS_ERROR||"OSM veri döndürmedi."
    );
    return null;
  }

  const cands=[];

  for(const el of parkData.elements){
    const geometry=extractRings(el);

    if(!geometry)continue;

    const hasGeometry=
      Array.isArray(geometry)
        ? geometry.length>0
        : (
          geometry.outer &&
          geometry.outer.length>0
        );

    if(!hasGeometry)continue;

    const area=polyArea(geometry);

    cands.push({
      rings:geometry,
      name:(el.tags&&el.tags.name)||null,
      area,
      type:el.type,
      id:el.id
    });
  }

  if(!cands.length)return null;

  const inside=cands.filter(c=>
    pointInPark(
      lat,
      lon,
      c.rings
    )
  );

  const sorted=inside.length
    ? inside.slice().sort((a,b)=>a.area-b.area)
    : cands.slice().sort((a,b)=>a.area-b.area);

  return sorted;
}

/* =========================================================
   DETAILED COVERAGE QUERY
========================================================= */

async function queryDetailedCoverage(){
  if(
    !PARK_POLY||
    !PARK_POLY.length
  ){
    return false;
  }

  IMP_RINGS=[];
  IMP_LINES=[];
  GRID_BLOCK_LINES=[];
  WATER_RINGS=[];
  WATER_LINES=[];

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

  const pad=0.0005;

  const bbox=
    `${minLat-pad},${minLon-pad},`+
    `${maxLat+pad},${maxLon+pad}`;

  /*
   * TEK sorgu:
   * Su + bina + building:part + yol + area:highway +
   * otopark + spor alanları + sert surface.
   *
   * Böylece aynı park için 2-3 ayrı Overpass çağrısı
   * yapmak yerine tek veri seti kullanıyoruz.
   */
  const q=
    `[out:json][timeout:90];(`+
    `way["natural"="water"](${bbox});`+
    `relation["natural"="water"](${bbox});`+
    `way["water"](${bbox});`+
    `relation["water"](${bbox});`+
    `way["landuse"~"reservoir|basin"](${bbox});`+
    `relation["landuse"~"reservoir|basin"](${bbox});`+
    `way["leisure"="swimming_pool"](${bbox});`+
    `relation["leisure"="swimming_pool"](${bbox});`+
    `way["waterway"="riverbank"](${bbox});`+
    `relation["waterway"="riverbank"](${bbox});`+

    `way["building"](${bbox});`+
    `relation["building"](${bbox});`+
    `way["building:part"](${bbox});`+
    `relation["building:part"](${bbox});`+
    `way["highway"](${bbox});`+
    `way["area:highway"](${bbox});`+
    `relation["area:highway"](${bbox});`+
    `way["landuse"="highway"](${bbox});`+
    `relation["landuse"="highway"](${bbox});`+
    `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `relation["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `way["leisure"~"pitch|track|playground"](${bbox});`+
    `relation["leisure"~"pitch|track|playground"](${bbox});`+
    `way["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
    `relation["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
    `way["man_made"~"pier|bridge"](${bbox});`+
    `relation["man_made"~"pier|bridge"](${bbox});`+
    `);out geom;`;

  const json=await overpassRequest(q,"yüzey+su");

  if(!json){
    console.warn(
      "Detaylı yüzey sorgusu başarısız:",
      LAST_OVERPASS_ERROR
    );
    return false;
  }

  const seenWater=new Set();
  const seenImp=new Set();

  for(const el of (json.elements||[])){
    const id=el.type+":"+el.id;

    if(isWater(el)){
      if(seenWater.has(id))continue;
      seenWater.add(id);

      if(el.type==="relation"){
        const r=extractRings(el);

        if(r){
          if(Array.isArray(r)){
            r.forEach(rr=>{
              if(rr&&rr.length>=3)WATER_RINGS.push(rr);
            });
          }else if(r.outer){
            r.outer.forEach(rr=>{
              if(rr&&rr.length>=3)WATER_RINGS.push(rr);
            });
          }
        }
        continue;
      }

      if(!el.geometry)continue;

      const pts=el.geometry.map(g=>[g.lat,g.lon]);

      if(isClosedLine(pts)){
        WATER_RINGS.push(pts);
      }else if(pts.length>1){
        WATER_LINES.push(pts);
      }

      continue;
    }

    if(!isImpervious(el))continue;
    if(seenImp.has(id))continue;

    seenImp.add(id);
    collectImperviousGeometry(el);
  }

  const pb={
    minLat,
    maxLat,
    minLon,
    maxLon
  };

  WATER_RINGS=WATER_RINGS.filter(r=>
    ringTouchesPark(r,PARK_POLY,pb)
  );

  WATER_LINES=WATER_LINES.filter(l=>
    lineTouchesPark(l,PARK_POLY,pb)
  );

  IMP_RINGS=IMP_RINGS.filter(r=>
    ringTouchesPark(r,PARK_POLY,pb)
  );

  IMP_LINES=IMP_LINES.filter(l=>
    lineTouchesPark(l.pts,PARK_POLY,pb)
  );

  GRID_BLOCK_LINES=GRID_BLOCK_LINES.filter(l=>
    lineTouchesPark(l,PARK_POLY,pb)
  );

  refreshWaterLayer();
  refreshImpLayer();

  console.log(
    "✓ Detaylı → Su polygon:",
    WATER_RINGS.length,
    "Su çizgi:",
    WATER_LINES.length,
    "Sert polygon:",
    IMP_RINGS.length,
    "Sert çizgi:",
    IMP_LINES.length
  );

  return true;
}
/* =========================================================
   SEGMENT INTERSECTION (lat/lon)
========================================================= */

function segmentsIntersectLatLon(a1,a2,b1,b2){
  const refLat=(a1[0]+a2[0]+b1[0]+b2[0])/4;
  const cosLat=Math.cos(refLat*Math.PI/180);
  const ax=a1[1]*111320*cosLat;
  const ay=a1[0]*110540;
  const bx=a2[1]*111320*cosLat;
  const by=a2[0]*110540;
  const cx=b1[1]*111320*cosLat;
  const cy=b1[0]*110540;
  const dx=b2[1]*111320*cosLat;
  const dy=b2[0]*110540;
  return segmentsIntersect({x:ax,y:ay},{x:bx,y:by},{x:cx,y:cy},{x:dx,y:dy});
}
/* =========================================================
   PARK INTERSECTION
========================================================= */

function ringTouchesPark(
  ring,
  parkRings,
  pb
){
  if(!ring||ring.length<3)return false;

  let minLat=90;
  let maxLat=-90;
  let minLon=180;
  let maxLon=-180;

  for(const p of ring){
    if(p[0]<minLat)minLat=p[0];
    if(p[0]>maxLat)maxLat=p[0];

    if(p[1]<minLon)minLon=p[1];
    if(p[1]>maxLon)maxLon=p[1];
  }

  const buf=0.0005;
  if(
    maxLat<pb.minLat-buf ||
    minLat>pb.maxLat+buf ||
    maxLon<pb.minLon-buf ||
    minLon>pb.maxLon+buf
  ){
    return false;
  }

  for(const p of ring){
    if(
      pointInPark(
        p[0],
        p[1],
        parkRings
      )
    ){
      return true;
    }
  }

  const centerLat=(minLat+maxLat)/2;
  const centerLon=(minLon+maxLon)/2;

  if(
    pointInPark(
      centerLat,
      centerLon,
      parkRings
    )
  ){
    return true;
  }

    for(let i=0;i<ring.length-1;i++){
    const a=ring[i];
    const b=ring[i+1];

    const lat=(a[0]+b[0])/2;
    const lon=(a[1]+b[1])/2;

    if(
      pointInPark(
        lat,
        lon,
        parkRings
      )
    ){
      return true;
    }
  }

  const parkOuter=Array.isArray(parkRings)?parkRings:(parkRings.outer||[]);
  for(const pRing of parkOuter){
    for(let i=0;i<pRing.length-1;i++){
      for(let j=0;j<ring.length-1;j++){
        if(segmentsIntersectLatLon(pRing[i],pRing[i+1],ring[j],ring[j+1])){
          return true;
        }
      }
    }
  }

  return false;
}

function lineTouchesPark(
  line,
  parkRings,
  pb
){
  if(!line||line.length<2)return false;

  let minLat=90;
  let maxLat=-90;
  let minLon=180;
  let maxLon=-180;

  for(const p of line){
    if(p[0]<minLat)minLat=p[0];
    if(p[0]>maxLat)maxLat=p[0];

    if(p[1]<minLon)minLon=p[1];
    if(p[1]>maxLon)maxLon=p[1];
  }

  const buf=0.0005;
  if(
    maxLat<pb.minLat-buf ||
    minLat>pb.maxLat+buf ||
    maxLon<pb.minLon-buf ||
    minLon>pb.maxLon+buf
  ){
    return false;
  }

  for(const p of line){
    if(
      pointInPark(
        p[0],
        p[1],
        parkRings
      )
    ){
      return true;
    }
  }

  for(let i=0;i<line.length-1;i++){
    const a=line[i];
    const b=line[i+1];

    const midLat=(a[0]+b[0])/2;

    const dy=
      (b[0]-a[0])*110540;

    const dx=
      (b[1]-a[1])*
      111320*
      Math.cos(midLat*Math.PI/180);

    const len=
      Math.sqrt(
        dx*dx+
        dy*dy
      );

   const steps=
      Math.max(
        1,
        Math.ceil(len/5)
      );

    for(let k=1;k<steps;k++){
      const t=k/steps;

      const lat=
        a[0]+
        (b[0]-a[0])*t;

      const lon=
        a[1]+
        (b[1]-a[1])*t;

         if(
        pointInPark(
          lat,
          lon,
          parkRings
        )
      ){
        return true;
      }
    }
  }

  const parkOuter=Array.isArray(parkRings)?parkRings:(parkRings.outer||[]);
  for(const pRing of parkOuter){
    for(let i=0;i<pRing.length-1;i++){
      for(let j=0;j<line.length-1;j++){
        if(segmentsIntersectLatLon(pRing[i],pRing[i+1],line[j],line[j+1])){
          return true;
        }
      }
    }
  }

  return false;
}


/* =========================================================
   OSM GEOMETRY
========================================================= */

function extractRings(el){
  function closeRing(r){
    if(!r||r.length<3)return null;

    const a=r[0];
    const b=r[r.length-1];

    if(
      Math.abs(a[0]-b[0])>1e-7 ||
      Math.abs(a[1]-b[1])>1e-7
    ){
      r.push([
        a[0],
        a[1]
      ]);
    }

    return r.length>=4?r:null;
  }

  if(
    el.type==="way" &&
    el.geometry
  ){
    const r=el.geometry.map(g=>[
      g.lat,
      g.lon
    ]);

    const closed=closeRing(r);

    return closed
      ? [closed]
      : null;
  }

  if(
    el.type==="relation" &&
    el.members
  ){
    const outerWays=
      el.members
        .filter(m=>
          m.role==="outer" &&
          m.geometry
        )
        .map(m=>
          m.geometry.map(g=>[
            g.lat,
            g.lon
          ])
        );

    const innerWays=
      el.members
        .filter(m=>
          m.role==="inner" &&
          m.geometry
        )
        .map(m=>
          m.geometry.map(g=>[
            g.lat,
            g.lon
          ])
        );

    const outer=
      joinWaysToRings(
        outerWays
      );

    const inner=
      joinWaysToRings(
        innerWays
      );

    if(!outer.length)return null;

    return{
      outer,
      inner
    };
  }

  return null;
}

function joinWaysToRings(ways){
  const rings=[];
  const rem=ways.slice();

    const eq=(a,b)=>
    Math.abs(a[0]-b[0])<1e-6 &&
    Math.abs(a[1]-b[1])<1e-6;

  while(rem.length){
    const ch=
      rem.shift().slice();

    let merged=true;
  let guard=
      ways.length*ways.length+100;

    while(
      merged &&
      guard-->0
    ){
      merged=false;

      for(let i=0;i<rem.length;i++){
        const w=rem[i];

        const head=ch[0];
        const tail=ch[ch.length-1];

        if(eq(tail,w[0])){
          ch.push(
            ...w.slice(1)
          );

          merged=true;
        }else if(
          eq(
            tail,
            w[w.length-1]
          )
        ){
          ch.push(
            ...w
              .slice()
              .reverse()
              .slice(1)
          );

          merged=true;
        }else if(
          eq(
            head,
            w[w.length-1]
          )
        ){
          ch.unshift(
            ...w.slice(0,-1)
          );

          merged=true;
        }else if(
          eq(
            head,
            w[0]
          )
        ){
          ch.unshift(
            ...w
              .slice()
              .reverse()
              .slice(0,-1)
          );

          merged=true;
        }

        if(merged){
          rem.splice(i,1);
          break;
        }
      }
    }

    if(ch.length>2){
      if(
        !eq(
          ch[0],
          ch[ch.length-1]
        )
      ){
        ch.push([
          ch[0][0],
          ch[0][1]
        ]);
      }

      rings.push(ch);
    }
  }

  return rings;
}



function refreshWaterLayer(){
  if(WATER_LAYER && map){
    map.removeLayer(WATER_LAYER);
  }

  WATER_LAYER=L.layerGroup().addTo(map);

  const satelliteMode=!!SATELLITE_LAYER;

  WATER_RINGS.forEach(r=>{
    if(!r||r.length<3)return;

    L.polygon(r,{
      color:"#2563eb",
      weight:satelliteMode?2:1,
      dashArray:satelliteMode?"6 4":null,
      fillColor:"#60a5fa",
      fillOpacity:satelliteMode?0:.42,
      interactive:false
    }).addTo(WATER_LAYER);
  });

  WATER_LINES.forEach(l=>{
    if(!l||l.length<2)return;

    L.polyline(l,{
      color:"#2563eb",
      weight:satelliteMode?3:2,
      opacity:satelliteMode?.9:.55,
      dashArray:satelliteMode?"6 4":null,
      interactive:false
    }).addTo(WATER_LAYER);
  });
}

function refreshImpLayer(){
  if(IMP_LAYER && map){
    map.removeLayer(IMP_LAYER);
  }

  IMP_LAYER=L.layerGroup().addTo(map);
  const satelliteMode=!!SATELLITE_LAYER;

  IMP_RINGS.forEach(r=>{
    if(!r || r.length<3){
      return;
    }

    let inside=0;

    for(const p of r){
      if(
        pointInPark(
          p[0],
          p[1],
          PARK_POLY
        )
      ){
        inside++;
      }
    }

    if(!inside){
      return;
    }

    L.polygon(
      r,
      {
        color:"#dc2626",
        weight:satelliteMode?2:1,
        dashArray:satelliteMode?"6 4":null,
        fillColor:"#ef4444",
        fillOpacity:satelliteMode?0:.18,
        interactive:false
      }
    ).addTo(IMP_LAYER);
  });

  IMP_LINES.forEach(l=>{
    if(
      !l ||
      !l.pts ||
      l.pts.length<2
    ){
      return;
    }

    let inside=false;

    for(const p of l.pts){
      if(
        pointInPark(
          p[0],
          p[1],
          PARK_POLY
        )
      ){
        inside=true;
        break;
      }
    }

    if(!inside){
      return;
    }

    L.polyline(
      l.pts,
      {
        color:"#ef4444",
        weight:3,
        opacity:.45,
        interactive:false
      }
    ).addTo(IMP_LAYER);
  });
}





/* =========================================================
   WATER
========================================================= */

function isWater(el){
  const t=el.tags||{};

  return(
    t.natural==="water" ||
    !!t.water ||
    t.landuse==="reservoir" ||
    t.landuse==="basin" ||
    t.leisure==="swimming_pool" ||
    t.waterway==="riverbank"
  );
}


/* =========================================================
   IMPERVIOUS (GÜÇLENDİRİLDİ)
   - softSurfaces eklendi
   - yumuşak yüzeyli yollar sert sayılmaz
========================================================= */

function isImpervious(el){
  const t=el.tags||{};

  const surface=
    String(
      t.surface||""
    )
    .toLowerCase()
    .trim();

  const hardSurfaces=new Set([
    "asphalt",
    "paved",
    "concrete",
    "paving_stones",
    "sett",
    "concrete:plates",
    "concrete:lanes",
    "cobblestone",
    "bricks",
    "metal",
    "wood"
  ]);

  const softSurfaces=new Set([
    "grass",
    "dirt",
    "earth",
    "ground",
    "gravel",
    "fine_gravel",
    "sand",
    "mud",
    "unpaved",
    "compacted",
    "woodchips",
    "pebblestone",
    "clay"
  ]);

  /*
   * Binalar
   */
  if(
    t.building ||
    t["building:part"]
  ){
    return true;
  }

  if(
    t["area:highway"] ||
    t.landuse==="highway"
  ){
    return true;
  }

  /*
   * Açıkça sert yüzey
   */
  if(
    hardSurfaces.has(surface)
  ){
    return true;
  }

  /*
   * Açıkça yumuşak yüzey
   */
  if(
    softSurfaces.has(surface)
  ){
    return false;
  }

  /*
   * Otopark
   */
  if(
    t.amenity==="parking" ||
    t.amenity==="bicycle_parking" ||
    t.amenity==="motorcycle_parking"
  ){
    return true;
  }

  /*
   * Saha / kort
   */
  if(
    t.leisure==="pitch" ||
    t.leisure==="track" ||
    t.leisure==="playground"
  ){
    return hardSurfaces.has(surface);
  }

  /*
   * Yollar
   */
  if(t.highway){
    const hw=
      String(
        t.highway
      ).toLowerCase();

    /*
     * Bunlar surface belirtilmemişse
     * otomatik sert kabul edilmesin.
     */
    const softWays=new Set([
      "footway",
      "path",
      "cycleway",
      "steps",
      "pedestrian",
      "bridleway",
      "track"
    ]);

    if(
      softWays.has(hw)
    ){
      return hardSurfaces.has(surface);
    }

    /*
     * Açıkça yumuşaksa sert değildir.
     */
    if(
      softSurfaces.has(surface)
    ){
      return false;
    }

    /*
     * Motorlu araç yollarında surface
     * belirtilmemişse sert kabul ediyoruz.
     */
    return true;
  }

  return false;
}

function isClosedLine(l){
  return(
    l &&
    l.length>2 &&
    Math.abs(
      l[0][0]-
      l[l.length-1][0]
    )<1e-7 &&
    Math.abs(
      l[0][1]-
      l[l.length-1][1]
    )<1e-7
  );
}


/* =========================================================
   ROAD WIDTH
========================================================= */

function roadHalfWidth(hw){
  hw=
    String(hw||"")
      .toLowerCase();

  if(/^motorway$/.test(hw))return 6;
  if(/^trunk$/.test(hw))return 5.5;
  if(/^primary$/.test(hw))return 5;
  if(/^secondary$/.test(hw))return 4.5;
  if(/^tertiary$/.test(hw))return 4;

  if(/^residential$/.test(hw))return 3;
  if(/^unclassified$/.test(hw))return 3;
  if(/^living_street$/.test(hw))return 3;

  if(/^service$/.test(hw))return 2.5;

  if(/^footway$/.test(hw))return 1;
  if(/^path$/.test(hw))return 1;
  if(/^cycleway$/.test(hw))return 1.2;
  if(/^pedestrian$/.test(hw))return 1.5;
  if(/^steps$/.test(hw))return 1;
  if(/^bridleway$/.test(hw))return 1;
  if(/^track$/.test(hw))return 1.5;

  return 3;
}


/* =========================================================
   COLLECT IMPERVIOUS (KRİTİK DÜZELTME)
   KURAL: Kapalı = alan, Açık = çizgi
   Asla açık yolu polygon yapmayacağız.
========================================================= */

function collectImperviousGeometry(el){
  if(el.type==="relation"){
    const r=extractRings(el);

    if(!r)return;

    if(Array.isArray(r)){
      r.forEach(rr=>{
        if(
          rr &&
          rr.length>=3
        ){
          IMP_RINGS.push(rr);
        }
      });
    }else if(r.outer){
      r.outer.forEach(rr=>{
        if(
          rr &&
          rr.length>=3
        ){
          IMP_RINGS.push(rr);
        }
      });
    }

    return;
  }

  if(!el.geometry)return;

  const pts=
    el.geometry.map(g=>[
      g.lat,
      g.lon
    ]);

  if(pts.length<2)return;

  const t=el.tags||{};

  const surface=
    String(
      t.surface||""
    ).toLowerCase().trim();

  const hardSurfaces=new Set([
    "asphalt",
    "concrete",
    "paving_stones",
    "sett",
    "concrete:plates",
    "concrete:lanes",
    "cobblestone",
    "bricks",
    "metal"
  ]);

  const isArea=
    !!t.building ||
    t.amenity==="parking" ||
    t.amenity==="bicycle_parking" ||
    t.amenity==="motorcycle_parking" ||
    !!t["area:highway"] ||
    t.landuse==="highway" ||
    (
      (
        t.leisure==="pitch" ||
        t.leisure==="track" ||
        t.leisure==="playground"
      ) &&
      hardSurfaces.has(surface)
    );

  /*
   * Kapalı polygon → alan
   */
  if(isClosedLine(pts)){
    if(isArea){
      IMP_RINGS.push(pts);
      return;
    }

    /*
     * Kapalı ama sert olarak tanımlanmamış
     * polygon ise alma.
     */
    return;
  }

  /*
   * AÇIK geometri → asla polygon yapma!
   * Sadece çizgi olarak işle.
   * Bu, "yamuk yumuk şekilsiz sert zemin"
   * sorununu ortadan kaldırır.
   */

  let w=0;

  if(t.highway){
    const width=
      parseFloat(
        String(
          t.width||""
        ).replace(",",".")
      );

    if(
      Number.isFinite(width) &&
      width>0 &&
      width<30
    ){
      w=width/2;
    }else{
      const lanes=parseFloat(
        String(t.lanes||"").replace(",",".")
      );

      if(
        Number.isFinite(lanes) &&
        lanes>0 &&
        lanes<10
      ){
        w=Math.max(
          1.25,
          (lanes*3.0)/2
        );
      }else{
        w=roadHalfWidth(
          t.highway
        );
      }
    }
  }else if(hardSurfaces.has(surface)){
    w=3;
  }else{
    w=2;
  }

  IMP_LINES.push({
    pts,
    w
  });

  if(
    t.highway &&
    !/^(footway|path|cycleway|steps|pedestrian|bridleway|track)$/
      .test(
        String(t.highway).toLowerCase()
      )
  ){
    GRID_BLOCK_LINES.push(pts);
  }
}


/* =========================================================
   PARK MODE
========================================================= */

function toggleParkMode(){
  PARK_MODE=!PARK_MODE;

  const b=$("parkModeBtn");

  b.textContent=
    "🌳 Park Analizi: "+
    (
      PARK_MODE
        ?"AÇIK"
        :"KAPALI"
    );

  b.className=
    "btn sm "+
    (
      PARK_MODE
        ?""
        :"blue"
    );

  $("parkModeHint").textContent=
    PARK_MODE
      ?"Şimdi parkın içine tıkla."
      :"Açınca parka tıkla.";

  bindParkClick();

  if(!PARK_MODE){
    PARK_CANDS=[];

    clearPark();
  }
}

function bindParkClick(){
  if(
    PARK_CLICK_BOUND ||
    !map
  ){
    return;
  }

  PARK_CLICK_BOUND=true;

  map.on(
    "click",
    async e=>{
      if(!PARK_MODE)return;

      toast(
        "🌳 Park sorgulanıyor…",
        "info"
      );

      const parks=
        await queryPark(
          e.latlng.lat,
          e.latlng.lng
        );

      if(
        !parks ||
        !parks.length
      ){
        return toast(
          "Park bulunamadı.",
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
   DRAW PARK (MODERN UI)
========================================================= */

async function drawPark(park){
  PARK_SELECTED_AREA_M2=Number.isFinite(Number(park?.area)) ? Number(park.area) : null;
  ensurePngUiStyles();

  /*
   * queryPark artık sadece park geometrisini getiriyor.
   * clearPark() güvenle çalışabilir; su/yüzey verisi
   * yüzey analizinde tek sorguyla yüklenecek.
   */
  clearPark();
  clearGrid();

  PARK_POLY=
    Array.isArray(park.rings)
      ? park.rings
      : park.rings.outer;

  PARK_HOLES=
    Array.isArray(park.rings)
      ? []
      : (
        park.rings.inner||[]
      );

  PARK_LAYER=
    L.layerGroup().addTo(map);

  L.polygon(
    PARK_POLY,
    {
      color:"#2b6cb0",
      weight:2.5,
      dashArray:"6,6",
      fillColor:"#3b82f6",
      fillOpacity:.10,
      interactive:false
    }
  ).addTo(PARK_LAYER);

  PARK_HOLES.forEach(r=>{
    L.polygon(
      r,
      {
        color:"#2b6cb0",
        weight:1.5,
        fillColor:"#ffffff",
        fillOpacity:.85,
        interactive:false
      }
    ).addTo(PARK_LAYER);
  });

  /*
   * OSM hard-exclusion geometry MUST be loaded before the grid can be
   * considered valid. Previously queryDetailedCoverage() existed but was
   * never called from drawPark(), which meant buildings, roads, parking
   * and water arrays stayed empty and the grid could be drawn over them.
   */
  const coverageOk=await queryDetailedCoverage();
  if(!coverageOk){
    console.warn("DENDROGEO QC: OSM detailed coverage could not be loaded.");
    toast("⚠ OSM bina/yol/su geometrisi alınamadı; grid bilimsel olarak eksik olabilir.","warn","🗺️");
  }

  /* Su katmanı yüzey sorgusundan sonra refreshWaterLayer() ile çizilir. */

  /* =====================================================
     PARK BOUNDS (manuel, L.layerGroup getBounds yok)
  ===================================================== */

  const parkBounds = L.latLngBounds(PARK_POLY);

  if(PARK_HOLES && PARK_HOLES.length){
    PARK_HOLES.forEach(ring=>{
      ring.forEach(p=>{
        parkBounds.extend(p);
      });
    });
  }

  if(parkBounds.isValid()){
    map.fitBounds(
      parkBounds,
      {
        padding:[30,30]
      }
    );
  }

  const haTotal =
    parkAreaHa().toFixed(1);

  const alt=
    PARK_CANDS.length>1
      ?
      `<select id="parkAlt" onchange="switchPark(+this.value)" style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
      PARK_CANDS
        .map(
          (c,i)=>
            `<option value="${i}"${c===park?" selected":""}>`+
            `${esc(c.name||"Alan "+(i+1))} · ${(c.area/10000).toFixed(1)} ha`+
            `</option>`
        )
        .join("")+
      `</select>`
      :
      "";

  $("parkInfo").style.display="block";

  $("parkInfo").innerHTML=

    `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">`+
      `<b style="font-size:1.15rem">🌳 ${esc(park.name||"İsimsiz Park")}</b>`+
      `<span class="dg-png-badge">`+
        `${haTotal} ha`+
      `</span>`+
      `<span id="refBadge" class="dg-png-ref" style="display:none"></span>`+
      alt+
    `</div>`+

    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">`+

      `<div class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">1 · GRID & WAYPOINT</div>`+
            `<div class="dg-png-title">🔲 Grid sistemi</div>`+
            `<div class="dg-png-sub">Ölçüm alanını otomatik böl</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-fields">`+
          `<div class="dg-png-field">`+
            `<label class="dg-png-label">PROJE</label>`+
            `<select id="gridProject" class="dg-png-select">`+
              (typeof PROJ_LIST!=="undefined"&&PROJ_LIST.length
                ? PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")
                : `<option value="0">Önce proje oluştur</option>`)+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">GRID BOYUTU</label>`+
            `<select id="gridSize" class="dg-png-select">`+
              `<option value="10">10 × 10 m · Hassas</option>`+
              `<option value="20" selected>20 × 20 m · Standart</option>`+
              `<option value="50">50 × 50 m · Hızlı</option>`+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">REFERANS ALAN (HA)</label>`+
            `<input id="refHa" type="number" step="0.1" placeholder="örn. 50.8" class="dg-png-input" onchange="setRefHa(this.value)">`+
          `</div>`+
        `</div>`+

        `<button class="dg-png-btn primary" onclick="buildGrid()">`+
          `🔲 Grid Oluştur`+
        `</button>`+
      `</div>`+

      `<div class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">2 · YÜZEY ANALİZİ</div>`+
            `<div class="dg-png-title">🌿 Arazi örtüsü</div>`+
            `<div class="dg-png-sub">Bina · yol · otopark · saha · su</div>`+
          `</div>`+
          `<span class="dg-png-badge blue">10 m uydu rasterı</span>`+
        `</div>`+

        `<button class="dg-png-btn primary" onclick="runLandCoverAnalysis()">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park sınırı + OSM geometrisi + 10 m Sentinel-2 LULC ile bağımsız analiz.`+
        `</div>`+
      `</div>`+

      `<div class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">3 · RAPOR PNG</div>`+
            `<div class="dg-png-title">🖼️ Harita çıktısı</div>`+
            `<div class="dg-png-sub">Park şeklinde yüksek çözünürlük</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-field">`+
          `<label class="dg-png-label">ALTLIK</label>`+
          `<select id="pngBg" class="dg-png-select">`+
            `<option value="vector">Vektör · Temiz beyaz</option>`+
            `<option value="osm">OSM · Sokak</option>`+
            `<option value="sat">Uydu</option>`+
            `<option value="topo">Topoğrafik</option>`+
          `</select>`+
        `</div>`+

        `<div class="dg-png-field">`+
          `<label class="dg-png-label">GÖRÜNÜM KATMANLARI</label>`+
          `<div class="dg-png-options">`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">🔲</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Grid hücreleri</strong>`+
                `<span>Analiz hücrelerini göster</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngGrid" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">📍</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Waypoint'ler</strong>`+
                `<span>Ölçüm noktaları</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngWp" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">💧</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Su / sert zemin</strong>`+
                `<span>Yapısal yüzeyler</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngCover" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

          `</div>`+
        `</div>`+

        `<button class="dg-png-btn ghost" onclick="downloadParkImage()">`+
          `🖼️ PNG İndir`+
        `</button>`+
      `</div>`+

      `<div class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">4 · KATMANLAR</div>`+
            `<div class="dg-png-title">🗺️ Görünürlük</div>`+
            `<div class="dg-png-sub">Harita üzerindeki katmanlar</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-options">`+

          `<label class="dg-png-option">`+
            `<span class="dg-png-icon">🔲</span>`+
            `<span class="dg-png-copy">`+
              `<strong>Grid hücreleri</strong>`+
              `<span>Harita üzerinde göster</span>`+
            `</span>`+
            `<input type="checkbox" id="togGrid" checked onchange="toggleGridVis()">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

          `<label class="dg-png-option">`+
            `<span class="dg-png-icon">📍</span>`+
            `<span class="dg-png-copy">`+
              `<strong>Waypoint'ler</strong>`+
              `<span>Ölçüm noktalarını göster</span>`+
            `</span>`+
            `<input type="checkbox" id="togWp" checked onchange="toggleWpVis()">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

        `</div>`+

        `<button class="dg-png-btn red sm" onclick="clearGrid()">`+
          `✕ Tümünü Temizle`+
        `</button>`+
      `</div>`+

    `</div>`+

    `<div id="landCoverReport" class="dg-png-result" style="display:none"></div>`+
    `<div id="gridSummary" class="dg-png-result" style="display:none"></div>`;

  renderRefBadge();

  toast(
    "✓ Park algılandı: "+
    haTotal+
    " ha",
    "ok",
    "🌳"
  );
}


/* =========================================================
   MODERN UI STYLES
========================================================= */

function ensurePngUiStyles(){
  if(document.getElementById("dgPngUiStyles")) return;

  const style = document.createElement("style");
  style.id = "dgPngUiStyles";

  style.textContent = `
    .dg-png-card{
      border:1px solid var(--line);
      border-radius:14px;
      padding:14px;
      background:var(--bg);
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .dg-png-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
    }

    .dg-png-kicker{
      font-size:.66rem;
      letter-spacing:.12em;
      color:var(--mut);
      font-weight:700;
      margin-bottom:3px;
      text-transform:uppercase;
    }

    .dg-png-title{
      font-size:.92rem;
      font-weight:700;
      line-height:1.25;
    }

    .dg-png-sub{
      font-size:.72rem;
      color:var(--mut);
      line-height:1.4;
      margin-top:2px;
    }

    .dg-png-badge{
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:3px 9px;
      border-radius:999px;
      font-size:.68rem;
      font-weight:700;
      background:rgba(34,197,94,.12);
      color:#16a34a;
      white-space:nowrap;
    }

    .dg-png-badge.amber{background:rgba(245,158,11,.14);color:#b45309;}
    .dg-png-badge.blue{background:rgba(59,130,246,.14);color:#1d4ed8;}

    .dg-png-label{
      display:block;
      font-size:.62rem;
      letter-spacing:.1em;
      font-weight:700;
      color:var(--mut);
      margin-bottom:5px;
      text-transform:uppercase;
    }

    .dg-png-fields{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .dg-png-field{
      display:flex;
      flex-direction:column;
    }

    .dg-png-select,
    .dg-png-input{
      width:100%;
      min-height:36px;
      padding:7px 10px;
      border:1px solid var(--line);
      border-radius:9px;
      background:var(--bg);
      color:inherit;
      font-size:.8rem;
      font-family:inherit;
      outline:none;
      transition:border-color .15s ease, box-shadow .15s ease;
    }

    .dg-png-select:focus,
    .dg-png-input:focus{
      border-color:#22c55e;
      box-shadow:0 0 0 3px rgba(34,197,94,.12);
    }

    .dg-png-options{
      border:1px solid var(--line);
      border-radius:11px;
      overflow:hidden;
      background:var(--bg);
    }

    .dg-png-option{
      position:relative;
      display:flex;
      align-items:center;
      gap:10px;
      min-height:54px;
      padding:9px 11px;
      cursor:pointer;
      transition:background .16s ease, transform .08s ease;
      user-select:none;
    }

    .dg-png-option + .dg-png-option{
      border-top:1px solid var(--line);
    }

    .dg-png-option:hover{
      background:rgba(128,128,128,.06);
    }

    .dg-png-option:active{
      transform:scale(.995);
    }

    .dg-png-option input{
      position:absolute;
      opacity:0;
      width:1px;
      height:1px;
      pointer-events:none;
    }

    .dg-png-icon{
      width:30px;
      height:30px;
      flex:0 0 30px;
      display:grid;
      place-items:center;
      border-radius:9px;
      background:rgba(128,128,128,.10);
      font-size:.92rem;
    }

    .dg-png-copy{
      flex:1;
      min-width:0;
    }

    .dg-png-copy strong{
      display:block;
      font-size:.78rem;
      font-weight:700;
      line-height:1.25;
    }

    .dg-png-copy span{
      display:block;
      margin-top:2px;
      color:var(--mut);
      font-size:.66rem;
      line-height:1.3;
    }

    .dg-png-switch{
      position:relative;
      width:38px;
      height:22px;
      flex:0 0 38px;
      border-radius:999px;
      background:#aab2bd;
      transition:background .18s ease;
    }

    .dg-png-switch::after{
      content:"";
      position:absolute;
      width:16px;
      height:16px;
      left:3px;
      top:3px;
      border-radius:50%;
      background:#fff;
      box-shadow:0 1px 4px rgba(0,0,0,.25);
      transition:transform .18s ease;
    }

    .dg-png-option input:checked + .dg-png-switch{
      background:#16a34a;
    }

    .dg-png-option input:checked + .dg-png-switch::after{
      transform:translateX(16px);
    }

    .dg-png-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      width:100%;
      min-height:40px;
      padding:9px 14px;
      border-radius:10px;
      border:1px solid transparent;
      font-size:.82rem;
      font-weight:700;
      letter-spacing:.01em;
      cursor:pointer;
      transition:transform .08s ease, box-shadow .18s ease, background .15s ease, border-color .15s ease;
      background:var(--btn-bg, #14532d);
      color:var(--btn-fg, #fff);
      font-family:inherit;
    }

    .dg-png-btn:hover{
      transform:translateY(-1px);
      box-shadow:0 4px 12px rgba(0,0,0,.08);
    }

    .dg-png-btn:active{
      transform:translateY(0);
      box-shadow:none;
    }

    .dg-png-btn.primary{
      background:linear-gradient(180deg, #16a34a, #15803d);
      color:#fff;
    }

    .dg-png-btn.blue{
      background:linear-gradient(180deg, #3b82f6, #1d4ed8);
      color:#fff;
    }

    .dg-png-btn.ghost{
      background:transparent;
      color:inherit;
      border-color:var(--line);
    }

    .dg-png-btn.ghost:hover{
      background:rgba(128,128,128,.06);
    }

    .dg-png-btn.red{
      background:linear-gradient(180deg, #ef4444, #b91c1c);
      color:#fff;
    }

    .dg-png-btn.sm{
      min-height:34px;
      font-size:.76rem;
      padding:6px 12px;
    }

    .dg-png-result{
      margin-top:10px;
      padding:12px;
      border:1px solid var(--line);
      border-radius:11px;
      background:var(--bg);
      font-size:.82rem;
      line-height:1.6;
    }

    #refBadge.dg-png-ref{
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:2px 9px;
      border-radius:999px;
      font-size:.7rem;
      font-weight:600;
      background:rgba(20,83,45,.1);
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   CLEAR
========================================================= */

function clearPark(){
  if(
    PARK_LAYER &&
    map
  ){
    map.removeLayer(
      PARK_LAYER
    );

    PARK_LAYER=null;
  }

  if(
    WATER_LAYER &&
    map
  ){
    map.removeLayer(
      WATER_LAYER
    );

    WATER_LAYER=null;
  }

  if(
    IMP_LAYER &&
    map
  ){
    map.removeLayer(
      IMP_LAYER
    );

    IMP_LAYER=null;
  }

  if(SATELLITE_LAYER && map){
    map.removeLayer(SATELLITE_LAYER);
    SATELLITE_LAYER=null;
  }
PARK_POLY=null;
  PARK_HOLES=[];

  WATER_RINGS=[];
  WATER_LINES=[];

  IMP_RINGS=[];
  IMP_LINES=[];

  GRID_BLOCK_LINES=[];

  LANDCOVER=null;
  LANDCOVER_SAMPLES=[];
  DG_PARK_PIXEL_GEOMETRY=null;
}

function switchPark(i){
  const p=PARK_CANDS[i];

  if(p){
    drawPark(p);
  }
}


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

  const{data}=await sb
    .from("measurements")
    .select("lat,lon")
    .eq("status","Onaylı")
    .gte("lat",minLat)
    .lte("lat",maxLat)
    .gte("lon",minLon)
    .lte("lon",maxLon)
    .limit(5000);

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
      lat:+c.lat.toFixed(6),
      lon:+c.lon.toFixed(6),
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


/* =========================================================
   LINE UTILITIES
========================================================= */

function lineLengthM(l){
  let len=0;

  for(let i=1;i<l.length;i++){
    const dy=
      (l[i][0]-l[i-1][0])*
      110540;

    const dx=
      (l[i][1]-l[i-1][1])*
      111320*
      Math.cos(
        l[i][0]*
        Math.PI/180
      );

    len+=Math.sqrt(
      dx*dx+
      dy*dy
    );
  }

  return len;
}

function downloadBlob(
  name,
  mime,
  text
){
  const b=
    new Blob(
      [text],
      {
        type:mime
      }
    );

  const u=
    URL.createObjectURL(b);

  const a=
    document.createElement(
      "a"
    );

  a.href=u;
  a.download=name;
  a.click();

  setTimeout(
    ()=>URL.revokeObjectURL(u),
    1000
  );
}

function downloadGridGeoJSON(){
  if(!GRID_CELLS.length){
    return toast(
      "Önce grid"
    );
  }

  const fc={
    type:"FeatureCollection",

    features:
      GRID_CELLS.map(c=>({
        type:"Feature",

        properties:{
          id:c.id,
          olcum:c.n,
          durum:
            c.n===0
              ?"bos"
              :"olculmus"
        },

        geometry:{
          type:"Polygon",

          coordinates:[
            [
              [c.w0,c.s0],
              [c.w1,c.s0],
              [c.w1,c.s1],
              [c.w0,c.s1],
              [c.w0,c.s0]
            ]
          ]
        }
      }))
  };

  downloadBlob(
    "dendrogeo_grid.geojson",
    "application/geo+json",
    JSON.stringify(
      fc,
      null,
      2
    )
  );

  toast(
    "✓ Grid indirildi",
    "ok",
    "📥"
  );
}

function downloadWaypointsCSV(){
  const rows=
    LAST_WP_ROWS.length
      ?LAST_WP_ROWS
      :WP;

  if(
    !rows||
    !rows.length
  ){
    return toast(
      "WP yok"
    );
  }

  let csv=
    "wp_id,lat,lon,visited\n";

  rows.forEach(r=>{
    csv+=
      r.wp_id+
      ","+
      r.lat+
      ","+
      r.lon+
      ","+
      (r.visited?1:0)+
      "\n";
  });

  downloadBlob(
    "dendrogeo_wp.csv",
    "text/csv",
    csv
  );

  toast(
    "✓ "+
    rows.length+
    " WP",
    "ok",
    "📥"
  );
}


/* =========================================================
   DENDROGEO — SCIENTIFIC SATELLITE LAND-COVER ENGINE v5
   ---------------------------------------------------------
   ANA SAYISAL SONUÇ:
     ArcGIS ImageServer computeStatisticsHistograms
     + gerçek park polygonu + Year=2020.

   QC:
     ArcGIS getSamples ile bağımsız örnek noktaları.
     getSamples örnek sayısı "piksel sayısı" olarak adlandırılmaz.

   VERİ SETİ:
     Sınıf CSV + örnek noktaları GeoJSON olarak dışa aktarılır.

   NOT:
     OSM su/sert yüzey geometrileri yalnızca yapısal QC'dir;
     Sentinel-2/IO LULC sınıflarını sessizce değiştirmez.
========================================================= */

const DG_S2_LULC_SERVICE=
  "https://ic.imagery1.arcgis.com/arcgis/rest/services/"+
  "Sentinel2_10m_LandCover/ImageServer";

const DG_S2_LULC_YEAR=2020;
const DG_S2_LULC_PIXEL_M=10;
const DG_S2_START_MS=Date.UTC(2020,0,1);
const DG_S2_END_MS=Date.UTC(2021,0,1)-1;
const DG_S2_MAX_EXPORT_PX=1800;

/*
 * Impact Observatory / Microsoft / Esri current 9-class schema.
 * Values 3 and 6 are legacy v1.0 values and are normalized to 11
 * only when an old value is actually returned by a service request.
 */
const DG_S2_OFFICIAL_CODES=[1,2,4,5,7,8,9,10,11];

const DG_S2_CLASS_NAMES={
  1:"Su",
  2:"Ağaç",
  3:"Eski sınıf · Çayır",
  4:"Taşkın vejetasyon",
  5:"Tarım",
  6:"Eski sınıf · Çalı / çalılık",
  7:"Yapılı alan",
  8:"Çıplak zemin",
  9:"Kar / buz",
  10:"Bulut",
  11:"Mera / rangeland"
};

const DG_S2_CLASS_COLORS={
  1:"#419bdf",
  2:"#397d49",
  3:"#76a65b",
  4:"#7a87c6",
  5:"#e49635",
  6:"#8fb35a",
  7:"#c4281b",
  8:"#a59b8f",
  9:"#a8ebff",
  10:"#616161",
  11:"#e3e2c3"
};

function dgS2NormalizeCode(code){
  const n=Math.round(Number(code));
  if(!Number.isFinite(n))return null;
  if(n===3||n===6)return 11;
  return DG_S2_OFFICIAL_CODES.includes(n)?n:null;
}

function dgS2Group(code){
  if(code===1)return "water";
  if([2,4,11].includes(code))return "vegetation";
  if(code===5)return "crops";
  if(code===7)return "hard";
  if(code===8||code===9)return "other";
  if(code===10)return "masked";
  return "unknown";
}

function dgS2OfficialClass(code){
  return DG_S2_OFFICIAL_CODES.includes(Number(code));
}

function dgS2IsKnownOrLegacy(code){
  const n=Math.round(Number(code));
  return DG_S2_OFFICIAL_CODES.includes(n)||n===3||n===6;
}

function dgParkBBox(){
  let minLat=90;
  let maxLat=-90;
  let minLon=180;
  let maxLon=-180;

  for(const ring of (PARK_POLY||[])){
    for(const p of (ring||[])){
      const lat=Number(p[0]);
      const lon=Number(p[1]);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
      minLat=Math.min(minLat,lat);
      maxLat=Math.max(maxLat,lat);
      minLon=Math.min(minLon,lon);
      maxLon=Math.max(maxLon,lon);
    }
  }

  return{minLat,maxLat,minLon,maxLon};
}

function dgRingSignedAreaLonLat(ring){
  if(!Array.isArray(ring)||ring.length<3)return 0;
  let a=0;

  for(let i=0;i<ring.length-1;i++){
    const p=ring[i];
    const q=ring[i+1];
    a+=Number(p[1])*Number(q[0])-
      Number(q[1])*Number(p[0]);
  }

  return a/2;
}

function dgCloseRing(ring){
  if(!Array.isArray(ring)||ring.length<3)return null;

  const out=ring
    .filter(p=>
      Array.isArray(p)&&
      Number.isFinite(Number(p[0]))&&
      Number.isFinite(Number(p[1]))
    )
    .map(p=>[Number(p[0]),Number(p[1])]);

  if(out.length<3)return null;

  const first=out[0];
  const last=out[out.length-1];

  if(
    Math.abs(first[0]-last[0])>1e-10||
    Math.abs(first[1]-last[1])>1e-10
  ){
    out.push([first[0],first[1]]);
  }

  return out.length>=4?out:null;
}

function dgOrientRingForArcGIS(ring,isHole){
  const r=dgCloseRing(ring);
  if(!r)return null;

  const area=dgRingSignedAreaLonLat(r);
  const shouldBeClockwise=!isHole;

  if((shouldBeClockwise&&area>0)||(!shouldBeClockwise&&area<0)){
    const core=r.slice(0,-1).reverse();
    core.push([core[0][0],core[0][1]]);
    return core;
  }

  return r;
}

function dgSimplifyRingForRequest(ring,maxVertices=1200){
  const r=dgCloseRing(ring);
  if(!r||r.length-1<=maxVertices)return r;

  const core=r.slice(0,-1);
  const step=Math.ceil(core.length/maxVertices);
  const out=[];

  for(let i=0;i<core.length;i+=step){
    out.push(core[i]);
  }

  if(out.length>=3){
    out.push([out[0][0],out[0][1]]);
  }

  return out.length>=4?out:r;
}

function dgBuildArcGISParkGeometry(maxVertices=1200){
  const rings=[];

  for(const ring of (PARK_POLY||[])){
    const r=dgOrientRingForArcGIS(
      dgSimplifyRingForRequest(ring,maxVertices),
      false
    );
    if(r)rings.push(r);
  }

  for(const ring of (PARK_HOLES||[])){
    const r=dgOrientRingForArcGIS(
      dgSimplifyRingForRequest(ring,maxVertices),
      true
    );
    if(r)rings.push(r);
  }

  if(!rings.length){
    throw new Error("ArcGIS için geçerli park polygonu üretilemedi.");
  }

  return{
    rings,
    spatialReference:{wkid:4326}
  };
}

function dgBuildMosaicRule(){
  /*
   * The service currently has Year as sort field and defaults to a
   * different future sort value. Locking Year=2020 avoids accidental
   * selection of another annual mosaic.
   */
  return{
    mosaicMethod:"esriMosaicAttribute",
    sortField:"Year",
    sortValue:DG_S2_LULC_YEAR,
    ascending:true,
    where:"Year = "+DG_S2_LULC_YEAR,
    mosaicOperation:"MT_FIRST"
  };
}

function dgBuildHistogramUrl(maxVertices=1200){
  const params=new URLSearchParams({
    f:"json",
    geometryType:"esriGeometryPolygon",
    geometry:JSON.stringify(
      dgBuildArcGISParkGeometry(maxVertices)
    ),
    mosaicRule:JSON.stringify(
      dgBuildMosaicRule()
    ),
    time:DG_S2_START_MS+","+DG_S2_END_MS
  });

  return DG_S2_LULC_SERVICE+
    "/computeStatisticsHistograms?"+
    params.toString();
}

/*
 * ArcGIS histogram contract:
 *   bin width = (max - min) / size
 *   counts[i] = pixels in bin i.
 *
 * A categorical value is assigned by interval membership rather than
 * the old size-1 / round heuristic. This also handles -0.5..11.5
 * style categorical bins correctly.
 */
function dgHistogramBinIndexForValue(hist,value){
  if(
    !hist||
    !Array.isArray(hist.counts)||
    !hist.counts.length
  )return -1;

  const size=Math.max(
    1,
    Number(hist.size)||hist.counts.length
  );
  const min=Number(hist.min);
  const max=Number(hist.max);
  const n=Number(value);

  if(
    !Number.isFinite(min)||
    !Number.isFinite(max)||
    !Number.isFinite(n)||
    !(max>min)
  )return -1;

  const width=(max-min)/size;
  if(!(width>0))return -1;

  const candidate=Math.floor((n-min)/width);
  const candidates=[candidate,candidate-1,candidate+1];

  for(const idx of candidates){
    if(idx<0||idx>=hist.counts.length)continue;

    const lo=min+idx*width;
    const hi=min+(idx+1)*width;
    const last=idx===hist.counts.length-1;

    if(
      n>=lo&&
      (n<hi||(last&&n<=hi))
    ){
      return idx;
    }
  }

  return -1;
}

function dgHistogramValueCount(hist,code){
  const idx=dgHistogramBinIndexForValue(hist,code);
  return idx>=0
    ?Number(hist.counts[idx])||0
    :0;
}

function dgHistogramCountsRaw(hist){
  const out={};
  for(let code=0;code<=11;code++){
    out[code]=dgHistogramValueCount(hist,code);
  }
  return out;
}

function dgHistogramCounts(hist){
  const out={};
  for(const code of DG_S2_OFFICIAL_CODES){
    out[code]=0;
  }

  /*
   * Legacy 3 and 6 are normalized into current class 11.
   * Their values should be absent in the current 9-class service,
   * but handling them makes the client robust to old mosaics.
   */
  out[11]+=dgHistogramValueCount(hist,3);
  out[11]+=dgHistogramValueCount(hist,6);

  for(const code of DG_S2_OFFICIAL_CODES){
    if(code===11){
      out[code]+=dgHistogramValueCount(hist,11);
    }else{
      out[code]=dgHistogramValueCount(hist,code);
    }
  }

  return out;
}

function dgHistogramTotal(hist){
  if(!hist||!Array.isArray(hist.counts))return 0;
  return hist.counts.reduce(
    (s,v)=>s+(Number(v)||0),
    0
  );
}

function dgBuildExportImageUrl(){
  const b=dgParkBBox();

  const sw=dgLonLatToWebMercator(b.minLat,b.minLon);
  const ne=dgLonLatToWebMercator(b.maxLat,b.maxLon);

  const widthM=Math.max(1,ne.x-sw.x);
  const heightM=Math.max(1,ne.y-sw.y);

  const rawW=Math.max(
    1,
    Math.ceil(widthM/DG_S2_LULC_PIXEL_M)
  );

  const rawH=Math.max(
    1,
    Math.ceil(heightM/DG_S2_LULC_PIXEL_M)
  );

  const scale=Math.min(
    1,
    DG_S2_MAX_EXPORT_PX/Math.max(rawW,rawH)
  );

  const width=Math.max(
    1,
    Math.round(rawW*scale)
  );

  const height=Math.max(
    1,
    Math.round(rawH*scale)
  );

  /*
   * Visualization is returned in geographic coordinates so a Leaflet
   * ImageOverlay can place it without treating a WebMercator raster as
   * a linear lat/lon image.
   */
  const params=new URLSearchParams({
    f:"image",
    bbox:[
      b.minLon,
      b.minLat,
      b.maxLon,
      b.maxLat
    ].join(","),
    bboxSR:"4326",
    imageSR:"4326",
    size:width+","+height,
    format:"png32",
    interpolation:"RSP_NearestNeighbor",
    time:DG_S2_START_MS+","+DG_S2_END_MS,
    mosaicRule:JSON.stringify(dgBuildMosaicRule()),
    renderingRule:JSON.stringify({
      rasterFunction:
        "Cartographic Renderer for Visualization and Analysis"
    })
  });

  return{
    url:
      DG_S2_LULC_SERVICE+
      "/exportImage?"+
      params.toString(),
    bbox:b,
    width,
    height,
    sourcePixelM:DG_S2_LULC_PIXEL_M,
    effectivePixelM:{
      x:widthM/width,
      y:heightM/height
    }
  };
}

async function dgFetchSatelliteRaster(){
  const built=dgBuildExportImageUrl();

  const res=await fetch(
    built.url,
    {
      method:"GET",
      mode:"cors",
      cache:"no-store",
      headers:{Accept:"image/png"}
    }
  );

  if(!res.ok){
    const body=await res.text().catch(()=> "");
    throw new Error(
      "ArcGIS exportImage HTTP "+
      res.status+" · "+body.slice(0,300)
    );
  }

  const type=String(
    res.headers.get("content-type")||""
  ).toLowerCase();

  if(!type.includes("image")){
    throw new Error(
      "ArcGIS exportImage görüntü yerine beklenmeyen içerik döndürdü."
    );
  }

  return{
    blob:await res.blob(),
    bbox:built.bbox,
    width:built.width,
    height:built.height,
    sourcePixelM:built.sourcePixelM,
    effectivePixelM:built.effectivePixelM
  };
}

function dgDrawParkMaskPath(ctx,ring,bbox,width,height){
  if(!Array.isArray(ring)||ring.length<3)return;

  const dLon=bbox.maxLon-bbox.minLon;
  const dLat=bbox.maxLat-bbox.minLat;

  if(!(dLon>0&&dLat>0))return;

  for(let i=0;i<ring.length;i++){
    const p=ring[i];

    const x=(
      (Number(p[1])-bbox.minLon)/
      dLon
    )*width;

    const y=(
      (bbox.maxLat-Number(p[0]))/
      dLat
    )*height;

    if(i===0)ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }

  ctx.closePath();
}

async function dgClipRasterBlobToPark(blob,bbox,width,height){
  const bitmap=await createImageBitmap(blob);
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;

  const ctx=canvas.getContext("2d");
  if(!ctx){
    bitmap.close();
    throw new Error("Canvas 2D context oluşturulamadı.");
  }

  ctx.drawImage(bitmap,0,0,width,height);
  bitmap.close();

  ctx.globalCompositeOperation="destination-in";
  ctx.beginPath();

  for(const ring of (PARK_POLY||[])){
    dgDrawParkMaskPath(
      ctx,
      ring,
      bbox,
      width,
      height
    );
  }

  for(const ring of (PARK_HOLES||[])){
    dgDrawParkMaskPath(
      ctx,
      ring,
      bbox,
      width,
      height
    );
  }

  ctx.fill("evenodd");
  ctx.globalCompositeOperation="source-over";

  return canvas.toDataURL("image/png");
}

function dgPointInsideRings3857(x,y,rings){
  let insideOuter=false;

  for(const ring of (rings.outer||[])){
    if(
      Array.isArray(ring)&&
      ring.length>=3&&
      pointInPolygonXY(x,y,ring)
    ){
      insideOuter=true;
      break;
    }
  }

  if(!insideOuter)return false;

  for(const ring of (rings.holes||[])){
    if(
      Array.isArray(ring)&&
      ring.length>=3&&
      pointInPolygonXY(x,y,ring)
    ){
      return false;
    }
  }

  return true;
}

function dgParkRings3857(){
  const outer=(PARK_POLY||[]).map(r=>
    (r||[]).map(p=>
      dgLonLatToWebMercator(p[0],p[1])
    )
  );

  const holes=(PARK_HOLES||[]).map(r=>
    (r||[]).map(p=>
      dgLonLatToWebMercator(p[0],p[1])
    )
  );

  return{outer,holes};
}

/*
 * Deterministic 10 m query lattice in the service coordinate system.
 * This is a QC sample lattice, not the raster's exact zonal pixel grid.
 */
function dgBuild10mSamplePoints(){
  const bbox=dgParkBBox();

  const sw=dgLonLatToWebMercator(
    bbox.minLat,
    bbox.minLon
  );

  const ne=dgLonLatToWebMercator(
    bbox.maxLat,
    bbox.maxLon
  );

  const rings=dgParkRings3857();
  const points=[];

  const step=DG_S2_LULC_PIXEL_M;

  const minX=Math.floor(sw.x/step)*step+step/2;
  const minY=Math.floor(sw.y/step)*step+step/2;

  for(let y=minY;y<=ne.y;y+=step){
    for(let x=minX;x<=ne.x;x+=step){
      if(!dgPointInsideRings3857(x,y,rings))continue;

      points.push([
        Math.round(x*1000)/1000,
        Math.round(y*1000)/1000
      ]);
    }
  }

  return points;
}

function dgSampleLocationToLonLat(sample){
  const loc=sample?.location||sample?.geometry||null;
  if(!loc)return null;

  const x=Number(loc.x);
  const y=Number(loc.y);

  if(!Number.isFinite(x)||!Number.isFinite(y))return null;

  const wkid=
    Number(loc.spatialReference?.wkid)||
    Number(loc.spatialReference?.latestWkid)||
    3857;

  if(wkid===4326){
    return{
      lon:x,
      lat:y
    };
  }

  if(wkid===3857||wkid===102100){
    return dgWebMercatorToLonLat(x,y);
  }

  return null;
}

async function dgGetSamplesChunk(points){
  const params=new URLSearchParams({
    f:"json",
    geometryType:"esriGeometryMultipoint",
    geometry:JSON.stringify({
      points,
      spatialReference:{wkid:3857}
    }),
    pixelSize:"10,10",
    interpolation:"RSP_NearestNeighbor",
    returnFirstValueOnly:"true",
    outFields:"*",
    time:DG_S2_START_MS+","+DG_S2_END_MS,
    mosaicRule:JSON.stringify(dgBuildMosaicRule())
  });

  const res=await fetch(
    DG_S2_LULC_SERVICE+
      "/getSamples?"+
      params.toString(),
    {
      method:"GET",
      mode:"cors",
      cache:"no-store",
      headers:{Accept:"application/json"}
    }
  );

  const body=await res.text();

  if(!res.ok){
    throw new Error(
      "ArcGIS getSamples HTTP "+
      res.status+" · "+body.slice(0,300)
    );
  }

  const data=JSON.parse(body);

  if(data?.error){
    throw new Error(
      (data.error.message||"ArcGIS getSamples hatası")+
      (
        Array.isArray(data.error.details)&&
        data.error.details.length
          ?" · "+data.error.details.join(" | ")
          :""
      )
    );
  }

  return Array.isArray(data.samples)
    ?data.samples
    :[];
}

function dgParseSampleClass(sample){
  const raw=
    sample?.value ??
    sample?.pixelValue ??
    null;

  if(raw===null||raw===undefined)return null;

  if(Array.isArray(raw)){
    const n=Number(raw[0]);
    return Number.isFinite(n)?Math.round(n):null;
  }

  const m=String(raw).match(/-?\d+(?:\.\d+)?/);
  if(!m)return null;

  const n=Number(m[0]);
  return Number.isFinite(n)?Math.round(n):null;
}

async function dgDirectSatelliteSamples(){
  const requestedPoints=dgBuild10mSamplePoints();

  if(!requestedPoints.length){
    throw new Error(
      "Park içinde 10 m örnekleme noktası üretilemedi."
    );
  }

  const CHUNK=800;
  const chunks=[];

  for(let i=0;i<requestedPoints.length;i+=CHUNK){
    chunks.push(
      requestedPoints.slice(i,i+CHUNK)
    );
  }

  const samples=[];
  const errors=[];
  const CONCURRENCY=3;

  for(let i=0;i<chunks.length;i+=CONCURRENCY){
    const group=chunks.slice(i,i+CONCURRENCY);

    const results=await Promise.all(
      group.map(points=>
        dgGetSamplesChunk(points)
          .catch(error=>{
            errors.push(error);
            return [];
          })
      )
    );

    for(const rows of results){
      samples.push(...rows);
    }
  }

  if(!samples.length){
    throw new Error(
      "ArcGIS getSamples hiç örnek döndürmedi."
    );
  }

  const counts={};
  for(const code of DG_S2_OFFICIAL_CODES){
    counts[code]=0;
  }

  let noData=0;
  let unknown=0;
  let legacyRemapped=0;
  let locationMissing=0;

  const sampleRows=[];

  for(let i=0;i<samples.length;i++){
    const sample=samples[i];
    const rawCode=dgParseSampleClass(sample);
    const normalized=dgS2NormalizeCode(rawCode);

    if(rawCode===null){
      noData++;
      continue;
    }

    if(rawCode===3||rawCode===6){
      legacyRemapped++;
    }

    if(normalized===null){
      unknown++;
      continue;
    }

    counts[normalized]++;

    const ll=dgSampleLocationToLonLat(sample);
    if(!ll){
      locationMissing++;
      continue;
    }

    sampleRows.push({
      id:sampleRows.length+1,
      lat:+ll.lat.toFixed(7),
      lon:+ll.lon.toFixed(7),
      rawClassCode:rawCode,
      classCode:normalized,
      className:DG_S2_CLASS_NAMES[normalized],
      group:dgS2Group(normalized)
    });
  }

  const returned=samples.length;
  const requested=requestedPoints.length;
  const missing=Math.max(
    0,
    requested-returned
  );

  const classified=
    Object.values(counts)
      .reduce(
        (sum,n)=>sum+(Number(n)||0),
        0
      );

  if(!classified){
    throw new Error(
      "ArcGIS getSamples döndü ancak hiçbir geçerli LULC sınıfı okunamadı."
    );
  }

  return{
    points:requestedPoints,
    samples:sampleRows,
    counts,
    requested,
    returned,
    missing,
    noData,
    unknown,
    legacyRemapped,
    locationMissing,
    classified,
    errors
  };
}

let DG_S2_LEGEND=null;

function dgEnsureSatelliteLegend(){
  if(!map)return;

  if(DG_S2_LEGEND){
    try{map.removeControl(DG_S2_LEGEND);}catch{}
    DG_S2_LEGEND=null;
  }

  DG_S2_LEGEND=L.control({
    position:"bottomright"
  });

  DG_S2_LEGEND.onAdd=function(){
    const div=L.DomUtil.create(
      "div",
      "leaflet-control"
    );

    div.style.cssText=
      "background:rgba(255,255,255,.94);"+
      "padding:10px 11px;"+
      "border-radius:10px;"+
      "box-shadow:0 1px 5px rgba(0,0,0,.25);"+
      "font:12px/1.25 Arial,sans-serif;"+
      "max-width:240px;";

    div.innerHTML=
      "<b>Sentinel-2 / LULC 2020</b>"+
      DG_S2_OFFICIAL_CODES
        .map(code=>
          "<div style='display:flex;align-items:center;gap:6px;margin-top:4px'>"+
            "<span style='width:12px;height:12px;border-radius:2px;"+
              "display:inline-block;background:"+
              DG_S2_CLASS_COLORS[code]+
              ";border:1px solid rgba(0,0,0,.18)'></span>"+
            "<span>"+DG_S2_CLASS_NAMES[code]+"</span>"+
          "</div>"
        ).join("");

    L.DomEvent.disableClickPropagation(div);
    return div;
  };

  DG_S2_LEGEND.addTo(map);
}

async function dgRenderSatelliteRaster(rasterData=null){
  if(!map)return;

  if(SATELLITE_LAYER){
    map.removeLayer(SATELLITE_LAYER);
    SATELLITE_LAYER=null;
  }

  const raster=
    rasterData||
    await dgFetchSatelliteRaster();

  const imageUrl=
    await dgClipRasterBlobToPark(
      raster.blob,
      raster.bbox,
      raster.width,
      raster.height
    );

  SATELLITE_LAYER=L.imageOverlay(
    imageUrl,
    [
      [raster.bbox.minLat,raster.bbox.minLon],
      [raster.bbox.maxLat,raster.bbox.maxLon]
    ],
    {
      opacity:.78,
      interactive:false,
      zIndex:20
    }
  ).addTo(map);

  dgEnsureSatelliteLegend();
  refreshWaterLayer();
  refreshImpLayer();
}

function dgSatelliteReportRow(
  emoji,
  label,
  value,
  suffix="",
  tone
){
  return(
    "<div style='display:flex;align-items:center;gap:8px;margin:5px 0'>"+
      "<span style='width:18px'>"+emoji+"</span>"+
      "<span style='flex:1;font-size:.78rem'>"+label+"</span>"+
      "<b style='min-width:100px;text-align:right;font-size:.78rem'>"+
        value+
        suffix+
      "</b>"+
    "</div>"
  );
}

function dgSatelliteClassCSV(){
  if(!LANDCOVER)return "";

  const q=v=>
    '"'+String(v??"").replace(/"/g,'""')+
    '"';

  const meta=[
    ["dataset","Impact Observatory / Microsoft / Esri Sentinel-2 10m Land Cover"],
    ["year",DG_S2_LULC_YEAR],
    ["resolution_m",DG_S2_LULC_PIXEL_M],
    ["park_area_ha",LANDCOVER.total],
    ["method",LANDCOVER.method],
    ["source_url",LANDCOVER.sourceUrl],
    ["raster_cells_histogram",LANDCOVER.histogramPixelCount]
  ];

  const rows=[
    ["CLASS_CODE","CLASS_NAME","GROUP","RASTER_CELL_COUNT","AREA_HA","PERCENT","YEAR","RESOLUTION_M"]
  ];

  for(const code of DG_S2_OFFICIAL_CODES){
    const count=Number(LANDCOVER.rawClassCounts?.[code]||0);

    rows.push([
      code,
      q(DG_S2_CLASS_NAMES[code]),
      q(dgS2Group(code)),
      count,
      Number(LANDCOVER.classAreasM2?.[code]||0)/10000,
      Number(LANDCOVER.classPercent?.[code]||0),
      DG_S2_LULC_YEAR,
      DG_S2_LULC_PIXEL_M
    ].join(","));
  }

  const legacy3=Number(LANDCOVER.histogramRaw?.[3]||0);
  const legacy6=Number(LANDCOVER.histogramRaw?.[6]||0);

  rows.push([
    "META",
    q("NO_DATA / UNMAPPED"),
    q("quality_control"),
    Number(LANDCOVER.histogramUnmappedCount||0),
    Number(LANDCOVER.histogramUnmappedAreaHa||0),
    Number(LANDCOVER.histogramUnmappedPct||0),
    DG_S2_LULC_YEAR,
    DG_S2_LULC_PIXEL_M
  ].join(","));

  rows.push([
    "LEGACY_3",
    q("Eski sınıf · Çayır → Rangeland 11"),
    q("legacy"),
    legacy3,
    "",
    "",
    DG_S2_LULC_YEAR,
    DG_S2_LULC_PIXEL_M
  ].join(","));

  rows.push([
    "LEGACY_6",
    q("Eski sınıf · Çalı / çalılık → Rangeland 11"),
    q("legacy"),
    legacy6,
    "",
    "",
    DG_S2_LULC_YEAR,
    DG_S2_LULC_PIXEL_M
  ].join(","));

  return(
    "\uFEFF"+
    meta.map(r=>q(r[0])+","+q(r[1])).join("\n")+
    "\n\n"+
    rows.join("\n")+
    "\n"
  );
}

function dgDownloadSatelliteClassCSV(){
  if(!LANDCOVER){
    return toast(
      "Önce Sentinel-2 arazi örtüsü analizini çalıştırın.",
      "warn",
      "🛰️"
    );
  }

  downloadBlob(
    "dendrogeo_lulc_2020_classes.csv",
    "text/csv;charset=utf-8",
    dgSatelliteClassCSV()
  );

  toast(
    "✓ Sınıf veri seti indirildi.",
    "ok",
    "📥"
  );
}

function dgDownloadSatelliteSamplesGeoJSON(){
  if(
    !LANDCOVER||
    !Array.isArray(LANDCOVER.sampleRows)||
    !LANDCOVER.sampleRows.length
  ){
    return toast(
      "Örnek veri seti bulunamadı.",
      "warn",
      "🛰️"
    );
  }

  const fc={
    type:"FeatureCollection",
    name:"dendrogeo_sentinel2_lulc_qc_samples_2020",
    features:
      LANDCOVER.sampleRows.map(r=>({
        type:"Feature",
        properties:{
          sample_id:r.id,
          raw_class_code:r.rawClassCode,
          class_code:r.classCode,
          class_name:r.className,
          group:r.group,
          year:DG_S2_LULC_YEAR,
          resolution_m:DG_S2_LULC_PIXEL_M,
          source:
            "Impact Observatory / Microsoft / Esri Sentinel-2 10m Land Cover",
          method:
            "ArcGIS ImageServer getSamples QC sample"
        },
        geometry:{
          type:"Point",
          coordinates:[r.lon,r.lat]
        }
      }))
  };

  downloadBlob(
    "dendrogeo_lulc_2020_qc_samples.geojson",
    "application/geo+json;charset=utf-8",
    JSON.stringify(fc,null,2)
  );

  toast(
    "✓ LULC QC örnek GeoJSON'u indirildi.",
    "ok",
    "📍"
  );
}

function dgRenderSatelliteReport(
  rep,
  parkM2,
  landcover,
  classAreasM2
){
  if(!rep)return;

  const rows=
    DG_S2_OFFICIAL_CODES.map(code=>{
      const count=
        Number(landcover.rawClassCounts?.[code]||0);
      const area=
        Number(classAreasM2?.[code]||0);
      const pct=
        Number(landcover.classPercent?.[code]||0);

      const emoji=
        code===1?"💧":
        code===2?"🌳":
        code===4?"🌊":
        code===5?"🌾":
        code===7?"🧱":
        code===8?"🟫":
        code===9?"❄️":
        code===10?"☁️":
        "🟩";

      return(
        "<tr>"+
          "<td>"+emoji+"</td>"+
          "<td><b>"+DG_S2_CLASS_NAMES[code]+"</b></td>"+
          "<td class='mono'>"+
            count.toLocaleString("tr-TR")+
          "</td>"+
          "<td class='mono'>"+
            (area/10000).toFixed(2)+
          "</td>"+
          "<td class='mono'>%"+
            pct.toFixed(1)+
          "</td>"+
        "</tr>"
      );
    }).join("");

  const totalClass=
    DG_S2_OFFICIAL_CODES.reduce(
      (s,code)=>
        s+
        Number(landcover.rawClassCounts?.[code]||0),
      0
    );

  const unmapped=
    Number(landcover.histogramUnmappedCount||0);

  const sampleWarn=
    landcover.directSampleCount>0&&
    landcover.directSampleCoveragePct<95
      ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;"+
       "background:rgba(245,158,11,.10);color:#92400e;font-size:.68rem'>"+
       "⚠ getSamples QC kapsamı %"+
       landcover.directSampleCoveragePct.toFixed(1)+
       " · eksik örnek: "+
       landcover.directMissingSamples+
       "</div>"
      :"";

  const warn=
    landcover.qualityWarning
      ?"<div style='margin-top:8px;padding:8px 10px;border-radius:8px;"+
       "background:rgba(245,158,11,.10);color:#92400e;font-size:.68rem'>"+
       "⚠ QC: "+esc(landcover.qualityWarning)+
       "</div>"
      :"";

  rep.innerHTML=
    "<b>🛰️ Arazi Örtüsü · Sentinel-2 / 10 m · 2020</b>"+
    "<div style='font-size:.70rem;color:var(--mut);margin:7px 0 10px'>"+
      "<b>Ana sayısal sonuç: ArcGIS zonal histogramı.</b> "+
      "Yüzdeler, park polygonu içinde raster sınıf hücrelerinin "+
      "sunucu tarafında hesaplanan frekanslarından türetilir. "+
      "getSamples yalnızca bağımsız QC örneklemesidir ve "+
      "örnek sayısı raster piksel sayısı değildir."+
    "</div>"+
    "<div style='overflow:auto'>"+
      "<table>"+
        "<thead><tr>"+
          "<th></th>"+
          "<th>Sınıf</th>"+
          "<th>Raster hücresi</th>"+
          "<th>Alan</th>"+
          "<th>%</th>"+
        "</tr></thead>"+
        "<tbody>"+
          rows+
        "</tbody>"+
      "</table>"+
    "</div>"+
    "<div style='border-top:1px solid var(--line);margin-top:10px;padding-top:9px'>"+
      dgSatelliteReportRow(
        "🌿",
        "Doğal / yeşil bitki örtüsü",
        landcover.naturalVegetationHa.toFixed(2),
        " ha",
        DG_S2_CLASS_COLORS[11]
      )+
      dgSatelliteReportRow(
        "🌱",
        "Toplam bitkisel örtü · tarım dahil",
        landcover.totalVegetationHa.toFixed(2),
        " ha",
        DG_S2_CLASS_COLORS[5]
      )+
      dgSatelliteReportRow(
        "🧱",
        "Yapılı / built",
        landcover.hardHa.toFixed(2),
        " ha",
        DG_S2_CLASS_COLORS[7]
      )+
      dgSatelliteReportRow(
        "💧",
        "Su",
        landcover.waterHa.toFixed(2),
        " ha",
        DG_S2_CLASS_COLORS[1]
      )+
      dgSatelliteReportRow(
        "☁️",
        "Bulut / maskeli",
        landcover.maskedHa.toFixed(2),
        " ha",
        DG_S2_CLASS_COLORS[10]
      )+
    "</div>"+
    "<div style='font-size:.69rem;color:var(--mut);margin-top:10px'>"+
      "<b>Park geometrisi:</b> "+
      (parkM2/10000).toFixed(2)+
      " ha · <b>Histogram raster hücresi:</b> "+
      landcover.histogramPixelCount.toLocaleString("tr-TR")+
      " · <b>getSamples QC:</b> "+
      landcover.directSampleCount.toLocaleString("tr-TR")+
      " geçerli örnek · <b>İşlenemeyen/unmapped:</b> "+
      unmapped.toLocaleString("tr-TR")+
    "</div>"+
    "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>"+
      "<b>Taksonomi:</b> 1 Su · 2 Ağaç · 4 Taşkın vejetasyon · 5 Tarım · "+
      "7 Yapılı alan · 8 Çıplak zemin · 9 Kar/buz · 10 Bulut · 11 Rangeland. "+
      "Eski 3/6 değerleri dönerse 11 altında normalize edilir."+
    "</div>"+
    "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'>"+
      "<button class='btn sm ghost' onclick='downloadSatelliteClassCSV()'>"+
        "📥 Sınıf CSV"+
      "</button>"+
      "<button class='btn sm ghost' onclick='downloadSatelliteSamplesGeoJSON()'>"+
        "📍 QC örnek GeoJSON"+
      "</button>"+
    "</div>"+
    sampleWarn+
    warn;
}

async function dgSatelliteRun(){
  if(!PARK_POLY||!PARK_POLY.length){
    return toast(
      "Önce park seç",
      "warn",
      "🌳"
    );
  }

  if(SATELLITE_RUNNING){
    return toast(
      "🛰️ Uydu analizi zaten çalışıyor.",
      "info",
      "🛰️"
    );
  }

  SATELLITE_RUNNING=true;
  const rep=$("landCoverReport");

  try{
    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "⏳ Sentinel-2 / 10 m / 2020 · "+
        "server-side zonal raster analizi yapılıyor…";
    }

    LANDCOVER=null;
    LANDCOVER_SAMPLES=[];

    const parkM2=parkAreaM2();

    if(!(parkM2>0)){
      throw new Error(
        "Park alanı hesaplanamadı."
      );
    }

    /*
     * PRIMARY RESULT
     * -----------------------------
     * computeStatisticsHistograms is the authoritative zonal result.
     */
    const attempts=[1200,800,500,300];
    let data=null;
    let lastError=null;
    let usedVertices=0;
    let usedUrlLength=0;

    for(const maxVertices of attempts){
      try{
        const url=dgBuildHistogramUrl(
          maxVertices
        );

        usedVertices=maxVertices;
        usedUrlLength=url.length;

        const res=await fetch(
          url,
          {
            method:"GET",
            mode:"cors",
            cache:"no-store",
            headers:{Accept:"application/json"}
          }
        );

        const body=await res.text();

        if(!res.ok){
          throw new Error(
            "HTTP "+res.status+
            " · "+body.slice(0,300)
          );
        }

        data=JSON.parse(body);

        if(data?.error){
          throw new Error(
            (data.error.message||
              "ArcGIS histogram hatası")+
            (
              Array.isArray(data.error.details)&&
              data.error.details.length
                ?" · "+data.error.details.join(" | ")
                :""
            )
          );
        }

        if(
          !Array.isArray(data.histograms)||
          !data.histograms[0]
        ){
          throw new Error(
            "ArcGIS histogram döndürmedi."
          );
        }

        break;
      }catch(err){
        lastError=err;

        console.warn(
          "ArcGIS zonal histogram denemesi:",
          maxVertices,
          err
        );
      }
    }

    if(!data){
      throw new Error(
        "Park polygonu için ArcGIS zonal histogram alınamadı. "+
        (lastError?.message||
          "Bilinmeyen servis hatası")+
        " · URL="+usedUrlLength+
        " karakter"
      );
    }

    const hist=data.histograms[0];
    const histogramRaw=dgHistogramCountsRaw(hist);
    const classCounts=dgHistogramCounts(hist);
    const histogramPixelCount=dgHistogramTotal(hist);

    if(histogramPixelCount<=0){
      throw new Error(
        "Park içinde histogram geçerli raster hücresi döndürmedi."
      );
    }

    /*
     * All histogram bins are conserved. Official classes (plus legacy
     * remap) become the 9-class schema; every remaining bin is retained
     * as unmapped instead of silently disappearing.
     */
    const classCountTotal=
      DG_S2_OFFICIAL_CODES.reduce(
        (sum,code)=>
          sum+
          Number(classCounts[code]||0),
        0
      );

    const unmappedCount=Math.max(
      0,
      histogramPixelCount-classCountTotal
    );

    const classAreasM2={};
    for(const code of DG_S2_OFFICIAL_CODES){
      classAreasM2[code]=
        parkM2*
        (
          Number(classCounts[code]||0)/
          histogramPixelCount
        );
    }

    const classPercent={};
    for(const code of DG_S2_OFFICIAL_CODES){
      classPercent[code]=
        Number(classCounts[code]||0)/
        histogramPixelCount*
        100;
    }

    const waterM2=classAreasM2[1]||0;
    const treesM2=classAreasM2[2]||0;
    const floodedM2=classAreasM2[4]||0;
    const cropsM2=classAreasM2[5]||0;
    const hardM2=classAreasM2[7]||0;
    const otherM2=
      (classAreasM2[8]||0)+
      (classAreasM2[9]||0);
    const maskedM2=classAreasM2[10]||0;
    const rangelandM2=classAreasM2[11]||0;

    const naturalVegetationM2=
      treesM2+
      floodedM2+
      rangelandM2;

    const totalVegetationM2=
      naturalVegetationM2+
      cropsM2;

    const unmappedM2=
      parkM2*
      (
        unmappedCount/
        histogramPixelCount
      );

    /*
     * SECONDARY QC
     * -----------------------------
     * getSamples is independent from the zonal histogram and cannot
     * overwrite the primary area calculation.
     */
    const direct=await dgDirectSatelliteSamples();

    const directClassTotals=
      DG_S2_OFFICIAL_CODES.reduce(
        (s,code)=>
          s+
          Number(direct.counts[code]||0),
        0
      );

    let directMaxDiff=0;

    if(directClassTotals>0){
      for(const code of DG_S2_OFFICIAL_CODES){
        const hp=
          Number(classCounts[code]||0)/
          histogramPixelCount;

        const dp=
          Number(direct.counts[code]||0)/
          directClassTotals;

        directMaxDiff=
          Math.max(
            directMaxDiff,
            Math.abs(hp-dp)
          );
      }
    }

    const directClassSamplePct=
      directClassTotals>0
        ?directClassTotals/direct.requested*100
        :0;

    LANDCOVER={
      total:+(parkM2/10000).toFixed(2),
      geometricTotal:+(parkM2/10000).toFixed(2),

      green:+(
        naturalVegetationM2/10000
      ).toFixed(2),

      hard:+(
        hardM2/10000
      ).toFixed(2),

      water:+(
        waterM2/10000
      ).toFixed(2),

      other:+(
        otherM2/10000
      ).toFixed(2),

      masked:+(
        maskedM2/10000
      ).toFixed(2),

      vegetation:+(
        totalVegetationM2/10000
      ).toFixed(2),

      naturalVegetation:+(
        naturalVegetationM2/10000
      ).toFixed(2),

      crops:+(
        cropsM2/10000
      ).toFixed(2),

      trees:+(
        treesM2/10000
      ).toFixed(2),

      rangeland:+(
        rangelandM2/10000
      ).toFixed(2),

      floodedVegetation:+(
        floodedM2/10000
      ).toFixed(2),

      sampleM:DG_S2_LULC_PIXEL_M,

      /*
       * These are explicitly histogram raster cells, not getSamples points.
       */
      sampleCount:histogramPixelCount,
      satellitePixels:histogramPixelCount,
      requestedSamples:direct.requested,
      returnedSamples:direct.returned,
      missingSamples:direct.missing,
      invalidSamples:direct.unknown,
      noDataSamples:direct.noData,
      maskedSamples:direct.counts[10]||0,

      method:
        "ArcGIS ImageServer computeStatisticsHistograms · "+
        "gerçek park polygonu · Year=2020 · 10 m sınıflandırılmış raster",

      source:
        "Impact Observatory · Microsoft · Esri · "+
        "Sentinel-2 10 m Land Cover",

      sourceUrl:DG_S2_LULC_SERVICE,

      rawClassCounts:classCounts,
      histogramRaw,
      histogramPixelCount,
      histogramUnmappedCount:unmappedCount,
      histogramUnmappedAreaHa:+(
        unmappedM2/10000
      ).toFixed(4),
      histogramUnmappedPct:
        unmappedCount/
        histogramPixelCount*
        100,

      classAreasM2,
      classPercent,

      classCounts:{
        green:naturalVegetationM2,
        vegetation:totalVegetationM2,
        hard:hardM2,
        water:waterM2,
        other:otherM2,
        masked:maskedM2,
        nodata:unmappedM2
      },

      resolutionM:DG_S2_LULC_PIXEL_M,

      geometricAreaM2:parkM2,

      /*
       * Histogram-derived observed area conserves all returned bins
       * except an explicitly tracked unmapped remainder.
       */
      validAreaM2:
        parkM2-
        unmappedM2,

      sampledAreaM2:parkM2,
      returnedAreaM2:
        direct.returned/
        Math.max(1,direct.requested)*
        parkM2,

      cloudAreaM2:maskedM2,
      noDataAreaM2:unmappedM2,
      missingAreaM2:
        direct.missing/
        Math.max(1,direct.requested)*
        parkM2,

      unclassifiedAreaM2:unmappedM2,

      coveragePct:
        parkM2>0
          ?(parkM2-unmappedM2)/
           parkM2*
           100
          :0,

      /*
       * These are secondary QC metrics and must not be confused with
       * raster zonal coverage.
       */
      returnedCoveragePct:
        direct.returned/
        Math.max(1,direct.requested)*
        100,

      classifiedCoveragePct:
        parkM2>0
          ?(parkM2-unmappedM2)/
           parkM2*
           100
          :0,

      histogramMin:Number(hist.min),
      histogramMax:Number(hist.max),
      histogramSize:Number(hist.size),

      histogramBinWidth:
        Number(hist.max)>Number(hist.min)&&
        Number(hist.size)
          ?(
            Number(hist.max)-
            Number(hist.min)
           )/
           Number(hist.size)
          :null,

      requestVertexLimit:usedVertices,
      histogramUrlLength:usedUrlLength,

      directSampleCount:direct.classified,
      directRequestedPoints:direct.requested,
      directReturnedSamples:direct.returned,
      directMissingSamples:direct.missing,
      directNoDataSamples:direct.noData,
      directInvalidSamples:direct.unknown,
      directLegacyRemapped:direct.legacyRemapped,
      directLocationMissing:direct.locationMissing,
      directSampleCoveragePct:
        direct.requested>0
          ?direct.classified/
           direct.requested*
           100
          :0,

      directMaxClassShareDiffPct:
        directMaxDiff*100,

      sampleRows:direct.samples,

      legacyClassPixels:
        (histogramRaw[3]||0)+
        (histogramRaw[6]||0),

      qualityWarning:"",
      rasterUnmatchedPixels:unmappedCount,
      rasterUnmatchedPct:
        unmappedCount/
        histogramPixelCount*
        100,

      rasterEffectivePixelM:DG_S2_LULC_PIXEL_M,

      histogramClassCounts:classCounts,
      histogramAllBins:histogramPixelCount,

      /*
       * Backward-compatible names used by other UI/export code.
       */
      vegetationBreakdown:{
        trees:treesM2,
        flooded:floodedM2,
        crops:cropsM2,
        rangeland:rangelandM2,
        legacyGrass:
          classAreasM2[11]*
          (
            (histogramRaw[3]||0)/
            Math.max(
              1,
              (classCounts[11]||0)
            )
          ),
        legacyScrub:
          classAreasM2[11]*
          (
            (histogramRaw[6]||0)/
            Math.max(
              1,
              (classCounts[11]||0)
            )
          )
      }
    };

    if(unmappedCount>0){
      LANDCOVER.qualityWarning+=
        "Histogramda 9 sınıfa eşlenemeyen "+
        unmappedCount+
        " raster hücresi var; bu hücreler sessizce sınıflara dağıtılmadı.";
    }

    if(LANDCOVER.legacyClassPixels>0){
      LANDCOVER.qualityWarning+=
        (
          LANDCOVER.qualityWarning
            ?" ":""
        )+
        "Eski Grass/Scrub kodları 11 Rangeland altında normalize edildi.";
    }

    if(direct.noData>0||direct.unknown>0){
      LANDCOVER.qualityWarning+=
        (
          LANDCOVER.qualityWarning
            ?" ":""
        )+
        "getSamples QC içinde "+
        (
          direct.noData+
          direct.unknown
        )+
        " örnek geçersiz/NoData döndü.";
    }

    if(direct.returned<direct.requested){
      LANDCOVER.qualityWarning+=
        (
          LANDCOVER.qualityWarning
            ?" ":""
        )+
        "getSamples tüm istenen örnek noktalarını döndürmedi.";
    }

    if(
      directClassTotals>0&&
      directMaxDiff>0.20
    ){
      LANDCOVER.qualityWarning+=
        (
          LANDCOVER.qualityWarning
            ?" ":""
        )+
        "Bağımsız getSamples QC dağılımı ile zonal histogram "+
        "arasındaki en büyük sınıf payı farkı %"+
        (directMaxDiff*100).toFixed(1)+
        ".";
    }

    LANDCOVER.qualityWarning=
      LANDCOVER.qualityWarning.trim();

    dgRenderSatelliteReport(
      rep,
      parkM2,
      LANDCOVER,
      classAreasM2
    );

    /*
     * Visualization is a separate concern. A renderer failure cannot
     * invalidate the zonal dataset.
     */
    try{
      const visualRaster=
        await dgFetchSatelliteRaster();

      await dgRenderSatelliteRaster(
        visualRaster
      );
    }catch(renderErr){
      LANDCOVER.visualizationError=
        renderErr?.message||
        String(renderErr);

      LANDCOVER.qualityWarning+=
        (
          LANDCOVER.qualityWarning
            ?" ":""
        )+
        "Sayısal zonal sonuç başarılı; harita katmanı üretilemedi: "+
        LANDCOVER.visualizationError;

      if(rep){
        dgRenderSatelliteReport(
          rep,
          parkM2,
          LANDCOVER,
          classAreasM2
        );
      }

      console.warn(
        "DENDROGEO · Sentinel-2 visualizasyon hatası:",
        renderErr
      );
    }

    console.log(
      "DENDROGEO · Sentinel-2 2020 zonal v5:",
      LANDCOVER
    );

    if(LANDCOVER.qualityWarning){
      toast(
        "✓ 2020 · 10 m zonal analiz tamamlandı; QC notu var.",
        "warn",
        "🛰️"
      );
    }else{
      toast(
        "✓ 2020 · 10 m zonal arazi örtüsü analizi tamamlandı.",
        "ok",
        "🛰️"
      );
    }

    return LANDCOVER;
  }catch(err){
    console.error(
      "DENDROGEO · Sentinel-2 analiz hatası:",
      err
    );

    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "<b>❌ Sentinel-2 / 10 m analizi tamamlanamadı.</b>"+
        "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+
          esc(err?.message||String(err))+
        "</div>"+
        "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>"+
          "Kısmi sonuç güvenilir kabul edilmedi ve rapora yazılmadı."+
        "</div>";
    }

    toast(
      "Sentinel-2/LULC analizi hatası: "+
      (err?.message||String(err)),
      "err",
      "🛰️"
    );

    return null;
  }finally{
    SATELLITE_RUNNING=false;
  }
}

// Inline HTML handlers require these public entry points.
window.toggleParkMode=toggleParkMode;
window.bindParkClick=bindParkClick;
window.clearPark=clearPark;
window.runLandCoverAnalysis=dgSatelliteRun;
window.downloadSatelliteClassCSV=dgDownloadSatelliteClassCSV;
window.downloadSatelliteSamplesGeoJSON=dgDownloadSatelliteSamplesGeoJSON;
