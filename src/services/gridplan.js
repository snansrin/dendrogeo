"use strict";
/* DendroGeo v2 · gridplan.js v134 — Land-cover source reset + OSM overlay decoupling */
  
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
let LANDCOVER=null;\nlet SATELLITE_RUNNING=false;
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

    /*
     * Any cell intersecting or lying inside a park hole is invalid.
     * Testing the hole's own centroid was insufficient when a cell
     * was fully enclosed by a larger hole.
     */
    if(pointInPolygon(cLat,cLon,ring))return false;

    for(const corner of corners){
      if(pointInPolygon(corner[0],corner[1],ring))return false;
    }

    if(
      geometryIntersectsRect(
        ring,
        rect,
        cLat,
        0
      )
    ){
      return false;
    }
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

async function queryDetailedCoverage(renderLayers=true){
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

  if(renderLayers){
    refreshWaterLayer();
    refreshImpLayer();
  }

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


  WATER_RINGS.forEach(r=>{
    if(!r||r.length<3)return;

    L.polygon(r,{
      color:"#2563eb",
      weight:1,
      dashArray:null,
      fillColor:"#60a5fa",
      fillOpacity:satelliteMode?0:.42,
      interactive:false
    }).addTo(WATER_LAYER);
  });

  WATER_LINES.forEach(l=>{
    if(!l||l.length<2)return;

    L.polyline(l,{
      color:"#2563eb",
      weight:2,
      opacity:.55,
      dashArray:null,
      interactive:false
    }).addTo(WATER_LAYER);
  });
}

function refreshImpLayer(){
  if(IMP_LAYER && map){
    map.removeLayer(IMP_LAYER);
  }

  IMP_LAYER=L.layerGroup().addTo(map);

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
        weight:1,
        dashArray:null,
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
  const hint=$("parkModeHint");

  if(b){
    b.textContent=
      "🌳 Park Analizi Modu: "+
      (PARK_MODE?"AÇIK":"KAPALI");

    b.classList.toggle("blue",!PARK_MODE);
    b.setAttribute(
      "aria-pressed",
      PARK_MODE?"true":"false"
    );
  }

  if(hint){
    hint.textContent=
      PARK_MODE
        ?"Şimdi haritada parkın içine tıkla."
        :"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
  }

  bindParkClick();

  if(!PARK_MODE){
    PARK_CANDS=[];
    clearPark();
    return;
  }

  if(!map){
    PARK_MODE=false;
    if(b){
      b.textContent="🌳 Park Analizi Modu: KAPALI";
      b.classList.add("blue");
      b.setAttribute("aria-pressed","false");
    }
    if(hint){
      hint.textContent=
        "Harita henüz hazır değil; tekrar deneyin.";
    }
    return;
  }

  toast(
    "🌳 Park Analizi modu açıldı. Haritada bir parkın içine tıklayın.",
    "ok",
    "🌳"
  );
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

      try{
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
          toast(
            "Park bulunamadı.",
            "warn"
          );
          return;
        }

        PARK_CANDS=parks;
        await drawPark(parks[0]);
      }catch(err){
        console.error(
          "DENDROGEO · Park tıklama hatası:",
          err
        );

        toast(
          "Park analizi başarısız: "+
          (err?.message||String(err)),
          "err",
          "🌳"
        );
      }
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
  /*
   * OSM yüzey geometrileri artık park seçimi sırasında otomatik çizilmez.
   * Arazi örtüsü sayısal sonucu yalnızca park polygonu + 10 m rasterdan üretir.
   */

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
          `<span class="dg-png-badge blue">10 m LULC · 2020</span>`+
        `</div>`+

        `<button class="dg-png-btn primary" onclick="runLandCoverAnalysis()">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park polygonu + doğal 10 m UTM LULC rasterı ile coverage-weighted zonal analiz.`+
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
\nPARK_POLY=null;
  PARK_HOLES=[];
  PARK_SELECTED_AREA_M2=null;

  WATER_RINGS=[];
  WATER_LINES=[];

  IMP_RINGS=[];
  IMP_LINES=[];

  GRID_BLOCK_LINES=[];

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

  if(
    !WATER_RINGS.length &&
    !WATER_LINES.length &&
    !IMP_RINGS.length &&
    !IMP_LINES.length &&
    !GRID_BLOCK_LINES.length
  ){
    await queryDetailedCoverage(false);
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
   LAND-COVER BRIDGE
   Numeric analysis lives in src/services/landcover.js.
========================================================= */

function runLandCoverAnalysis(){
  if(!window.DG_LANDCOVER || typeof window.DG_LANDCOVER.analyze!=="function"){
    return toast("10 m arazi örtüsü modülü yüklenmedi.","err","🗺️");
  }

  if(!PARK_POLY || !PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML="⏳ 10 m arazi örtüsü analizi hazırlanıyor…";
  }

  const parkArea=parkAreaM2();
  const holes=PARK_HOLES||[];

  window.DG_LANDCOVER.analyze({
    outer:PARK_POLY,
    holes,
    parkAreaM2:parkArea
  }).then(result=>{
    if(window.DG_LANDCOVER_RENDER_REPORT){
      window.DG_LANDCOVER_RENDER_REPORT(rep,result,parkArea);
    }
    toast("✓ 2020 · 10 m arazi örtüsü zonal analizi tamamlandı.","ok","🗺️");
  }).catch(err=>{
    console.error("DENDROGEO · Arazi örtüsü analizi:",err);
    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "<b>❌ 10 m arazi örtüsü analizi tamamlanamadı.</b>"+
        "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+esc(err?.message||String(err))+"</div>"+
        "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>Geçersiz veya eksik sonuç rapora yazılmadı.</div>";
    }
    toast("Arazi örtüsü analizi hatası: "+(err?.message||String(err)),"err","🗺️");
  });
}

window.runLandCoverAnalysis=runLandCoverAnalysis;
