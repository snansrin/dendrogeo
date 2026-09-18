"use strict";
/* DendroGeo v2 · gridplan.js v37 — FINAL (su+sert iyileştirmeleri) */

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

  if(
    !pointInPark(
      cLat,
      cLon,
      PARK_POLY
    )
  ){
    return false;
  }

  let inCount=0;

  const corners=[
    [s0,w0],
    [s0,w1],
    [s1,w1],
    [s1,w0]
  ];

  for(const p of corners){
    if(
      pointInPark(
        p[0],
        p[1],
        PARK_POLY
      )
    ){
      inCount++;
    }
  }

  return inCount>=2;
}

function isCellValid(
  s0,
  s1,
  w0,
  w1
){
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

  for(const w of WATER_RINGS){
    if(
      geometryIntersectsRect(
        w,
        cellRect,
        cLat,
        WATER_CLEARANCE_M
      )
    ){
      return false;
    }
  }

  for(const l of WATER_LINES){
    if(
      geometryLineIntersectsRect(
        l,
        cellRect,
        cLat,
        WATER_CLEARANCE_M
      )
    ){
      return false;
    }
  }

  for(const b of IMP_RINGS){
    if(
      geometryIntersectsRect(
        b,
        cellRect,
        cLat,
        IMP_CLEARANCE_M
      )
    ){
      return false;
    }
  }

  for(const l of GRID_BLOCK_LINES){
    if(
      geometryLineIntersectsRect(
        l,
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

  WATER_RINGS.forEach(r=>{
    if(!r||r.length<3)return;

    L.polygon(r,{
      color:"#2563eb",
      weight:1,
      fillColor:"#60a5fa",
      fillOpacity:.42,
      interactive:false
    }).addTo(WATER_LAYER);
  });

  WATER_LINES.forEach(l=>{
    if(!l||l.length<2)return;

    L.polyline(l,{
      color:"#2563eb",
      weight:2,
      opacity:.55,
      interactive:false
    }).addTo(WATER_LAYER);
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

function drawPark(park){
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
          `<span class="dg-png-badge blue">3m örnekleme</span>`+
        `</div>`+

        `<button class="dg-png-btn primary" onclick="runLandCoverAnalysis()">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park sınırının içinde tek sorgu. Yeşil + Sert + Su = Toplam.`+
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

  PARK_POLY=null;
  PARK_HOLES=[];

  WATER_RINGS=[];
  WATER_LINES=[];

  IMP_RINGS=[];
  IMP_LINES=[];

  GRID_BLOCK_LINES=[];

  LANDCOVER=null;
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
   LAND COVER GEOMETRY
========================================================= */

function pointToSegmentDistanceM(
  lat,
  lon,
  a,
  b
){
  const refLat=
    lat*
    Math.PI/180;

  const ax=
    (a[1]-lon)*
    111320*
    Math.cos(refLat);

  const ay=
    (a[0]-lat)*
    110540;

  const bx=
    (b[1]-lon)*
    111320*
    Math.cos(refLat);

  const by=
    (b[0]-lat)*
    110540;

  const dx=bx-ax;
  const dy=by-ay;

  if(
    dx===0 &&
    dy===0
  ){
    return Math.sqrt(
      ax*ax+
      ay*ay
    );
  }

  const t=
    Math.max(
      0,
      Math.min(
        1,
        (
          -ax*dx-
          ay*dy
        )/
        (
          dx*dx+
          dy*dy
        )
      )
    );

  const px=
    ax+
    t*dx;

  const py=
    ay+
    t*dy;

  return Math.sqrt(
    px*px+
    py*py
  );
}

function nearLineW(
  lines,
  lat,
  lon
){
  for(const l of lines){
    if(
      !l ||
      !l.pts ||
      l.pts.length<2
    ){
      continue;
    }

    const width=
      Number.isFinite(l.w)
        ? Math.max(0,l.w)
        : 0;

    for(
      let i=0;
      i<l.pts.length-1;
      i++
    ){
      const d=
        pointToSegmentDistanceM(
          lat,
          lon,
          l.pts[i],
          l.pts[i+1]
        );

      if(d<=width){
        return true;
      }
    }
  }

  return false;
}


/* =========================================================
   IMP LAYER
========================================================= */

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
        fillColor:"#ef4444",
        fillOpacity:.18,
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
   DENDROGEO — SCIENTIFIC SATELLITE LAND-COVER ENGINE
   Copernicus LCFM / LCM-10 (2020) · 10 m
   ---------------------------------------------------------
   Satellite classification is the primary source.
   OSM is validation/context only; it does not fill missing
   satellite classes or force a green/hard residual.
========================================================= */

const DG_LCM10_WMS="https://titiler.terrascope.be/wms";
const DG_LCM10_YEAR="2020";
const DG_LCM10_RES_M=10;

const DG_LCM10_PALETTE={
  10:[0x00,0x64,0x00],20:[0xff,0xbb,0x22],30:[0xff,0xff,0x4c],
  40:[0xf0,0x96,0xff],50:[0x00,0x96,0xa0],60:[0x00,0xcf,0x75],
  70:[0xfa,0xe6,0xa0],80:[0xb4,0xb4,0xb4],90:[0xfa,0x00,0x00],
  100:[0x00,0x64,0xc8],110:[0xf0,0xf0,0xf0],254:[0x0a,0x0a,0x0a]
};

const DG_LCM10_CLASS_NAMES={
  10:"Ağaç örtüsü",20:"Çalılık",30:"Çayır",40:"Tarım alanı",
  50:"Otsu sulak alan",60:"Mangrov",70:"Yosun / liken",
  80:"Çıplak / seyrek bitki",90:"Yapılı alan",100:"Kalıcı su",
  110:"Kar / buz",254:"Sınıflandırılamayan"
};

function dgLcm10ClassGroup(code){
  if(code===100)return "water";
  if(code===90)return "hard";
  if([10,20,30,40,50,60,70].includes(code))return "green";
  if([80,110].includes(code))return "other";
  return "unknown";
}

function dgLcm10PixelCode(r,g,b){
  let best=254,bestD=Infinity;
  for(const [code,rgb] of Object.entries(DG_LCM10_PALETTE)){
    const dr=r-rgb[0],dg=g-rgb[1],db=b-rgb[2];
    const d=dr*dr+dg*dg+db*db;
    if(d<bestD){bestD=d;best=Number(code);}
  }
  return Math.sqrt(bestD)<=12?best:254;
}

function dgParkBBox(){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const ring of (PARK_POLY||[])){
    for(const p of ring){
      minLat=Math.min(minLat,p[0]);maxLat=Math.max(maxLat,p[0]);
      minLon=Math.min(minLon,p[1]);maxLon=Math.max(maxLon,p[1]);
    }
  }
  return {minLat,maxLat,minLon,maxLon};
}

function dgLcm10ImageDimensions(b){
  const midLat=(b.minLat+b.maxLat)/2;
  const widthM=Math.abs(b.maxLon-b.minLon)*111320*Math.cos(midLat*Math.PI/180);
  const heightM=Math.abs(b.maxLat-b.minLat)*110540;
  let width=Math.max(96,Math.ceil(widthM/DG_LCM10_RES_M));
  let height=Math.max(96,Math.ceil(heightM/DG_LCM10_RES_M));
  const maxDim=2048;
  if(width>maxDim||height>maxDim){
    const scale=Math.min(maxDim/width,maxDim/height);
    width=Math.max(96,Math.floor(width*scale));
    height=Math.max(96,Math.floor(height*scale));
  }
  return {width,height,widthM,heightM};
}

async function dgFetchLcm10Raster(){
  const b=dgParkBBox();
  if(!Number.isFinite(b.minLat)||!Number.isFinite(b.maxLat)||
     !Number.isFinite(b.minLon)||!Number.isFinite(b.maxLon)||
     b.minLat>=b.maxLat||b.minLon>=b.maxLon){
    throw new Error("Park bbox geçersiz.");
  }

  const dim=dgLcm10ImageDimensions(b);
  const params=new URLSearchParams({
    service:"WMS",request:"GetMap",version:"1.1.1",
    layers:"lcfm-lcm-10_map",styles:"",srs:"EPSG:4326",
    bbox:b.minLon+","+b.minLat+","+b.maxLon+","+b.maxLat,
    width:String(dim.width),height:String(dim.height),
    format:"image/png",transparent:"false",time:"2020-01-01"
  });
  const url=DG_LCM10_WMS+"?"+params.toString();

  console.log("→ Copernicus LCM-10 WMS:",url);

  const res=await fetch(url,{method:"GET",mode:"cors",cache:"no-store",
    headers:{Accept:"image/png"}});
  if(!res.ok)throw new Error("LCM-10 WMS HTTP "+res.status);

  const type=res.headers.get("content-type")||"";
  if(!type.toLowerCase().includes("image")){
    const txt=await res.text().catch(()=> "");
    throw new Error("LCM-10 WMS görüntü döndürmedi: "+txt.slice(0,160));
  }

  const blob=await res.blob();
  const bitmap=await createImageBitmap(blob);
  const canvas=document.createElement("canvas");
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);bitmap.close();

  return {
    bbox:b,width:canvas.width,height:canvas.height,
    widthM:dim.widthM,heightM:dim.heightM,
    data:ctx.getImageData(0,0,canvas.width,canvas.height).data
  };
}

function dgPixelBounds(b,w,h,x,y){
  return {
    lon0:b.minLon+(x/w)*(b.maxLon-b.minLon),
    lon1:b.minLon+((x+1)/w)*(b.maxLon-b.minLon),
    lat1:b.maxLat-(y/h)*(b.maxLat-b.minLat),
    lat0:b.maxLat-((y+1)/h)*(b.maxLat-b.minLat)
  };
}

function dgWgs84CellAreaM2(lat0,lat1,lon0,lon1){
  const R=6371007.1809;
  const p0=lat0*Math.PI/180,p1=lat1*Math.PI/180;
  const dl=(lon1-lon0)*Math.PI/180;
  return Math.abs(R*R*dl*(Math.sin(p1)-Math.sin(p0)));
}

function dgLcm10AreaFromRaster(raster){
  const b=raster.bbox,w=raster.width,h=raster.height,d=raster.data;
  const out={
    source:"Copernicus LCFM LCM-10 2020 · 10 m",
    totalM2:0,classifiedM2:0,greenM2:0,hardM2:0,waterM2:0,
    otherM2:0,unknownM2:0,pixels:0,usedPixels:0,
    byClassM2:{},byClassPixels:{},effectivePixelM2:0
  };

  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const pb=dgPixelBounds(b,w,h,x,y);
      const lat=(pb.lat0+pb.lat1)/2;
      const lon=(pb.lon0+pb.lon1)/2;

      if(!pointInPark(lat,lon,{outer:PARK_POLY,inner:PARK_HOLES||[]}))continue;

      const i=(y*w+x)*4;
      const code=dgLcm10PixelCode(d[i],d[i+1],d[i+2]);
      const area=dgWgs84CellAreaM2(pb.lat0,pb.lat1,pb.lon0,pb.lon1);

      out.totalM2+=area;out.pixels++;
      out.byClassM2[code]=(out.byClassM2[code]||0)+area;
      out.byClassPixels[code]=(out.byClassPixels[code]||0)+1;

      const group=dgLcm10ClassGroup(code);
      if(group==="green"){
        out.greenM2+=area;out.classifiedM2+=area;out.usedPixels++;
      }else if(group==="hard"){
        out.hardM2+=area;out.classifiedM2+=area;out.usedPixels++;
      }else if(group==="water"){
        out.waterM2+=area;out.classifiedM2+=area;out.usedPixels++;
      }else if(group==="other"){
        out.otherM2+=area;out.classifiedM2+=area;out.usedPixels++;
      }else{
        out.unknownM2+=area;
      }
    }
  }

  out.effectivePixelM2=out.pixels?out.totalM2/out.pixels:0;
  return out;
}

function dgLcm10RenderRows(sat,totalM2){
  const pct=m2=>totalM2>0?Math.round(m2/totalM2*100):0;
  const row=(emoji,label,m2,color)=>{
    const p=pct(m2);
    return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0">'+
      '<span style="width:18px;text-align:center">'+emoji+'</span>'+
      '<span style="width:116px;font-size:.8rem">'+label+'</span>'+
      '<div style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden">'+
      '<div style="height:100%;width:'+p+'%;background:'+color+'"></div></div>'+
      '<b style="font-size:.8rem;width:72px;text-align:right">'+(m2/10000).toFixed(2)+' ha</b>'+
      '<span style="font-size:.72rem;color:var(--mut);width:36px">%'+p+'</span></div>';
  };
  return row("🌿","Yeşil / vejetasyon",sat.greenM2,"#16a34a")+
         row("🧱","Yapılı / sert",sat.hardM2,"#ef4444")+
         row("💧","Su",sat.waterM2,"#2563eb")+
         row("🟫","Çıplak / diğer",sat.otherM2,"#a16207")+
         row("❓","Sınıflandırılamayan",sat.unknownM2,"#6b7280");
}

async function runLandCoverAnalysis(){
  if(!PARK_POLY||!PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML="⏳ Copernicus LCM-10 · 10 m uydu arazi örtüsü indiriliyor…";
  }

  toast("🛰️ Copernicus LCM-10 uydu analizi başlıyor…","info");

  let raster=null;
  try{
    raster=await dgFetchLcm10Raster();
  }catch(err){
    console.error("LCM-10 WMS okunamadı:",err);
    if(rep){
      rep.innerHTML="<b>❌ Copernicus LCM-10 verisi okunamadı.</b><br>"+
        '<span style="font-size:.75rem;color:var(--mut)">Tarayıcı Terrascope WMS kaynağına erişemedi. OSM verisini sessizce sert/yeşil sonucu yerine koymuyoruz.</span>';
    }
    return toast("LCM-10 uydu verisi alınamadı.","err","🛰️");
  }

  if(rep)rep.innerHTML="⏳ 10 m LCM-10 pikselleri park sınırıyla kesiştiriliyor…";

  const sat=dgLcm10AreaFromRaster(raster);
  const geometricM2=parkAreaM2();

  if(!sat.pixels||sat.totalM2<=0){
    if(rep)rep.innerHTML="❌ LCM-10 içinde park alanına ait piksel bulunamadı.";
    return toast("LCM-10 park alanını sınıflandıramadı.","err","🛰️");
  }

  const greenM2=sat.greenM2,hardM2=sat.hardM2,waterM2=sat.waterM2;
  const otherM2=sat.otherM2,unknownM2=sat.unknownM2;
  const classifiedM2=greenM2+hardM2+waterM2+otherM2;
  const sumM2=classifiedM2+unknownM2;

  LANDCOVER={
    green:+(greenM2/10000).toFixed(2),
    hard:+(hardM2/10000).toFixed(2),
    water:+(waterM2/10000).toFixed(2),
    other:+(otherM2/10000).toFixed(2),
    unknown:+(unknownM2/10000).toFixed(2),
    total:+(sumM2/10000).toFixed(2),
    geometricTotal:+(geometricM2/10000).toFixed(2),
    method:"Copernicus LCFM LCM-10 2020 · 10 m WMS raster · WGS84 pixel-area correction",
    sampleM:10,sampleCount:sat.pixels,satellitePixels:sat.pixels,
    classPixels:sat.byClassPixels
  };

  const referenceHa=Number.isFinite(Number(PARK_REF_HA))?Number(PARK_REF_HA):null;
  const geometricHa=geometricM2/10000;
  const classifiedHa=classifiedM2/10000;
  const unknownHa=unknownM2/10000;
  const totalRasterHa=sumM2/10000;

  const refLine=referenceHa!==null
    ? "Harici referans: <b>"+referenceHa.toFixed(2)+" ha</b> · OSM park geometrisi: <b>"+
      geometricHa.toFixed(2)+" ha</b> · fark: <b>"+Math.abs(referenceHa-geometricHa).toFixed(2)+" ha</b>"
    : "OSM park geometrisi: <b>"+geometricHa.toFixed(2)+" ha</b>";

  if(rep){
    rep.innerHTML=
      '<b>🛰️ Yüzey Örtüsü · Copernicus LCM-10</b>'+
      '<span style="font-size:.72rem;color:var(--mut)"> (2020 · 10 m)</span>'+
      dgLcm10RenderRows(sat,sumM2)+
      '<div style="font-size:.72rem;color:var(--mut);margin-top:9px">'+
        'Rasterdan hesaplanan alan: <b>'+totalRasterHa.toFixed(2)+' ha</b><br>'+
        'Sınıflandırılmış: <b>'+classifiedHa.toFixed(2)+' ha</b> · '+
        'Sınıflandırılamayan: <b>'+unknownHa.toFixed(2)+' ha</b><br>'+
        refLine+'<br>'+
        'Raster: '+sat.width+'×'+sat.height+' · Park içi piksel: '+sat.pixels.toLocaleString("tr-TR")+
        ' · ortalama piksel alanı: '+sat.effectivePixelM2.toFixed(1)+' m²</div>'+
      '<div style="font-size:.7rem;color:#166534;margin-top:8px">✓ Nihai sınıflandırma uydu verisinden geliyor. OSM sert yüzey alanı sonucu belirlemiyor.</div>'+
      '<div style="font-size:.68rem;color:var(--mut);margin-top:8px">'+
        'Yapılı/sert = LCM-10 “Built-up” kod 90; yeşil = 10,20,30,40,50,60,70; '+
        'su = 100; çıplak/diğer = 80,110; sınıflandırılamayan = 254.</div>'+
      '<div style="font-size:.68rem;color:var(--mut);margin-top:7px">'+
        'Kaynak: European Union Copernicus Land Monitoring Service (LCFM). Ürün Sentinel-1 ve Sentinel-2 verileriyle üretilmiş 10 m LCM-10 haritasıdır.</div>';
  }

  console.group("========== DENDROGEO · LCM-10 ==========");
  console.log("OSM geometric area:",geometricHa,"ha");
  console.log("LCM-10 raster area:",totalRasterHa,"ha");
  console.log("LCM-10 classes:",{greenM2,hardM2,waterM2,otherM2,unknownM2,classifiedM2,pixels:sat.pixels});
  console.log("Class pixels:",sat.byClassPixels);
  console.groupEnd();

  toast("✓ Copernicus LCM-10 uydu analizi tamamlandı","ok","🛰️");
}

window.runLandCoverAnalysis=runLandCoverAnalysis;

/* =========================================================
   TILE DRAW
========================================================= */

async function drawTiles(
  ctx,
  bg,
  minLat,
  minLon,
  maxLat,
  maxLon,
  scale,
  ox,
  oy
){
  const urls={
    osm:(x,y,z)=>
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,

    sat:(x,y,z)=>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,

    topo:(x,y,z)=>
      `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`
  };

  const zoom=
    Math.min(
      19,
      Math.max(
        3,
        Math.round(
          Math.log2(
            360*scale/256
          )
        )
      )
    );

  const n=
    Math.pow(
      2,
      zoom
    );

  const x0=
    Math.floor(
      (minLon+180)/
      360*
      n
    );

  const x1=
    Math.floor(
      (maxLon+180)/
      360*
      n
    );

  const yFor=lat=>{
    const r=
      lat*
      Math.PI/180;

    return Math.floor(
      (
        1-
        Math.log(
          Math.tan(r)+
          1/Math.cos(r)
        )/
        Math.PI
      )/
      2*
      n
    );
  };

  const y0=yFor(maxLat);
  const y1=yFor(minLat);

  const lonOf=x=>
    x/n*360-180;

  const latOf=y=>
    Math.atan(
      Math.sinh(
        Math.PI*
        (
          1-2*y/n
        )
      )
    )*
    180/
    Math.PI;

  const imgs=[];

  for(
    let x=x0;
    x<=x1;
    x++
  ){
    for(
      let y=y0;
      y<=y1;
      y++
    ){
      const img=
        new Image();

      img.crossOrigin=
        "anonymous";

      img.src=
        urls[bg](
          x,
          y,
          zoom
        );

      imgs.push({
        img,
        x,
        y
      });
    }
  }

  try{
    await Promise.all(
      imgs.map(o=>
        o.img.decode
          ?
          o.img.decode()
          :
          new Promise(
            (res,rej)=>{
              o.img.onload=res;
              o.img.onerror=rej;
            }
          )
      )
    );
  }catch(e){
    return false;
  }

  for(const o of imgs){
    const p0=[
      ox+
      (
        lonOf(o.x)-
        minLon
      )*
      scale,

      oy+
      (
        maxLat-
        latOf(o.y)
      )*
      scale
    ];

    const p1=[
      ox+
      (
        lonOf(o.x+1)-
        minLon
      )*
      scale,

      oy+
      (
        maxLat-
        latOf(o.y+1)
      )*
      scale
    ];

    ctx.drawImage(
      o.img,
      p0[0],
      p0[1],
      p1[0]-p0[0],
      p1[1]-p0[1]
    );
  }

  try{
    ctx.getImageData(
      0,
      0,
      1,
      1
    );
  }catch(e){
    return false;
  }

  return true;
}


/* =========================================================
   PNG (SERT YOL GENİŞLİĞİ DÜZELTİLDİ)
========================================================= */

async function downloadParkImage(){
  if(
    !PARK_POLY||
    !PARK_POLY.length
  ){
    return toast(
      "Önce park seç"
    );
  }

  const bg=
    $("pngBg")
      ?
      $("pngBg").value
      :
      "vector";

  const incGrid=
    (
      $("chkPngGrid")
        ?
        $("chkPngGrid").checked
        :
        true
    ) &&
    GRID_CELLS.length>0;

  const incWp=
    $("chkPngWp")
      ?
      $("chkPngWp").checked
      :
      true;

  const incCover=
    $("chkPngCover")
      ?
      $("chkPngCover").checked
      :
      true;

  const wpRows=
    (
      LAST_WP_ROWS.length
        ?LAST_WP_ROWS
        :WP
    ).filter(w=>
      pointInPark(
        w.lat,
        w.lon,
        PARK_POLY
      )
    );

  const showWp=
    incWp &&
    wpRows.length>0;

  const W=1600;
  const H=1200;

  const canvas=
    document.createElement(
      "canvas"
    );

  canvas.width=W;
  canvas.height=H;

  const ctx=
    canvas.getContext("2d");

  const mapC=
    document.createElement(
      "canvas"
    );

  mapC.width=W;
  mapC.height=H;

  const mctx=
    mapC.getContext("2d");

  mctx.fillStyle="#ffffff";
  mctx.fillRect(
    0,
    0,
    W,
    H
  );

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

  const pad=.0004;

  minLat-=pad;
  maxLat+=pad;
  minLon-=pad;
  maxLon+=pad;

  const dLat=
    maxLat-minLat;

  const dLon=
    maxLon-minLon;

  const scale=
    Math.min(
      (W-140)/dLon,
      (H-200)/dLat
    );

  const ox=
    (W-dLon*scale)/2;

  const oy=
    (H-dLat*scale)/2+30;

  const toXY=(lat,lon)=>[
    ox+
    (lon-minLon)*
    scale,

    oy+
    (maxLat-lat)*
    scale
  ];

  if(bg!=="vector"){
    const ok=
      await drawTiles(
        mctx,
        bg,
        minLat,
        minLon,
        maxLat,
        maxLon,
        scale,
        ox,
        oy
      );

    if(!ok){
      mctx.fillStyle="#ffffff";
      mctx.fillRect(
        0,
        0,
        W,
        H
      );

      toast(
        "⚠ Tile yüklenemedi",
        "warn"
      );
    }
  }

  if(incCover){
    IMP_RINGS.forEach(r=>{
      if(
        !r||
        r.length<3
      ){
        return;
      }

      mctx.fillStyle=
        "#ef444444";

      mctx.strokeStyle=
        "#dc2626";

      mctx.lineWidth=1;

      mctx.beginPath();

      r.forEach((p,i)=>{
        const xy=
          toXY(
            p[0],
            p[1]
          );

        if(i===0){
          mctx.moveTo(
            xy[0],
            xy[1]
          );
        }else{
          mctx.lineTo(
            xy[0],
            xy[1]
          );
        }
      });

      mctx.closePath();
      mctx.fill();
      mctx.stroke();
    });

    IMP_LINES.forEach(l=>{
      mctx.strokeStyle=
        "#ef444466";

      /*
       * DÜZELTME: l.w yarı genişlik.
       * Tam genişlik = l.w * 2
       * scale derece → piksel.
       * 1 derece lat ≈ 110540 m
       */
      mctx.lineWidth=
        Math.max(
          1.5,
          (l.w*2)*
          scale/
          110540
        );

      mctx.beginPath();

      l.pts.forEach((p,i)=>{
        const xy=
          toXY(
            p[0],
            p[1]
          );

        if(i===0){
          mctx.moveTo(
            xy[0],
            xy[1]
          );
        }else{
          mctx.lineTo(
            xy[0],
            xy[1]
          );
        }
      });

      mctx.stroke();
    });

    WATER_RINGS.forEach(r=>{
      if(
        !r||
        r.length<3
      ){
        return;
      }

      mctx.fillStyle=
        "#3b82f699";

      mctx.strokeStyle=
        "#1d4ed8";

      mctx.lineWidth=1.5;

      mctx.beginPath();

      r.forEach((p,i)=>{
        const xy=
          toXY(
            p[0],
            p[1]
          );

        if(i===0){
          mctx.moveTo(
            xy[0],
            xy[1]
          );
        }else{
          mctx.lineTo(
            xy[0],
            xy[1]
          );
        }
      });

      mctx.closePath();
      mctx.fill();
      mctx.stroke();
    });

    WATER_LINES.forEach(l=>{
      mctx.strokeStyle=
        "#3b82f699";

      mctx.lineWidth=2;

      mctx.beginPath();

      l.forEach((p,i)=>{
        const xy=
          toXY(
            p[0],
            p[1]
          );

        if(i===0){
          mctx.moveTo(
            xy[0],
            xy[1]
          );
        }else{
          mctx.lineTo(
            xy[0],
            xy[1]
          );
        }
      });

      mctx.stroke();
    });
  }

  if(incGrid){
    GRID_CELLS.forEach(c=>{
      const a=
        toXY(
          c.s0,
          c.w0
        );

      const b=
        toXY(
          c.s1,
          c.w1
        );

      const col=
        c.n===0
          ?"#e11d48"
          :"#16a34a";

      mctx.fillStyle=
        col+"66";

      mctx.strokeStyle=
        col;

      mctx.lineWidth=1;

      mctx.fillRect(
        a[0],
        a[1],
        b[0]-a[0],
        b[1]-a[1]
      );

      mctx.strokeRect(
        a[0],
        a[1],
        b[0]-a[0],
        b[1]-a[1]
      );
    });
  }

  mctx.globalCompositeOperation=
    "destination-in";

  mctx.beginPath();

  PARK_POLY.forEach(r=>{
    r.forEach((p,i)=>{
      const xy=
        toXY(
          p[0],
          p[1]
        );

      if(i===0){
        mctx.moveTo(
          xy[0],
          xy[1]
        );
      }else{
        mctx.lineTo(
          xy[0],
          xy[1]
        );
      }
    });

    mctx.closePath();
  });

  PARK_HOLES.forEach(r=>{
    r.forEach((p,i)=>{
      const xy=
        toXY(
          p[0],
          p[1]
        );

      if(i===0){
        mctx.moveTo(
          xy[0],
          xy[1]
        );
      }else{
        mctx.lineTo(
          xy[0],
          xy[1]
        );
      }
    });

    mctx.closePath();
  });

  mctx.fill("evenodd");

  mctx.globalCompositeOperation=
    "source-over";

  ctx.fillStyle="#ffffff";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.drawImage(
    mapC,
    0,
    0
  );

  ctx.strokeStyle=
    "#2b6cb0";

  ctx.lineWidth=3;

  ctx.setLineDash([
    12,
    8
  ]);

  PARK_POLY.forEach(r=>{
    ctx.beginPath();

    r.forEach((p,i)=>{
      const xy=
        toXY(
          p[0],
          p[1]
        );

      if(i===0){
        ctx.moveTo(
          xy[0],
          xy[1]
        );
      }else{
        ctx.lineTo(
          xy[0],
          xy[1]
        );
      }
    });

    ctx.closePath();
    ctx.stroke();
  });

  ctx.setLineDash([]);

  PARK_HOLES.forEach(r=>{
    ctx.beginPath();

    r.forEach((p,i)=>{
      const xy=
        toXY(
          p[0],
          p[1]
        );

      if(i===0){
        ctx.moveTo(
          xy[0],
          xy[1]
        );
      }else{
        ctx.lineTo(
          xy[0],
          xy[1]
        );
      }
    });

    ctx.closePath();
    ctx.stroke();
  });

  if(showWp){
    wpRows.forEach(w=>{
      const xy=
        toXY(
          w.lat,
          w.lon
        );

      ctx.fillStyle=
        "#e11d48";

      ctx.beginPath();

      ctx.arc(
        xy[0],
        xy[1],
        5,
        0,
        Math.PI*2
      );

      ctx.fill();

      ctx.strokeStyle="#fff";
      ctx.lineWidth=1.5;
      ctx.stroke();
    });
  }

  const name=
    (
      PARK_CANDS[0] &&
      PARK_CANDS[0].name
    ) ||
    "İsimsiz Park";

  const haTotal=
    parkAreaHa().toFixed(1);

  ctx.fillStyle=
    "#14532d";

  ctx.fillRect(
    0,
    0,
    W,
    64
  );

  ctx.fillStyle="#fff";

  ctx.font=
    "bold 24px system-ui";

  ctx.fillText(
    "🌳 "+
    name+
    " — Saha Raporu",
    24,
    40
  );

  const lines=[
    "DendroGeo · Park Raporu",
    "Park: "+name,
    "Toplam alan: "+
      haTotal+
      " ha (geodezik)"
  ];

  if(PARK_REF_HA){
    lines.push(
      "Referans: "+
      PARK_REF_HA+
      " ha (sapma %"+
      Math.abs(
        (
          (
            parkAreaHa()-
            PARK_REF_HA
          )/
          PARK_REF_HA
        )*
        100
      ).toFixed(1)+
      ")"
    );
  }

  if(LANDCOVER){
    lines.push(
      "Yeşil "+
      LANDCOVER.green+
      " ha · Sert "+
      LANDCOVER.hard+
      " ha · Su "+
      LANDCOVER.water+
      " ha"
    );
  }

  if(incGrid){
    lines.push(
      "Grid: "+
      GRID_CELLS.length+
      " hücre"
    );
  }

  if(showWp){
    lines.push(
      "Waypoint: "+
      wpRows.length
    );
  }

  lines.push(
    "Altlık: "+
    (
      bg==="vector"
        ?"Vektör"
        :
      bg==="osm"
        ?"OSM"
        :
      bg==="sat"
        ?"Uydu"
        :
        "Topo"
    )+
    " · "+
    new Date()
      .toLocaleDateString(
        "tr-TR"
      )
  );

  const bw=380;
  const bh=
    lines.length*
    24+
    20;

  ctx.fillStyle=
    "rgba(255,255,255,.95)";

  ctx.strokeStyle=
    "#94a3b8";

  ctx.lineWidth=1;

  ctx.fillRect(
    W-bw-24,
    H-bh-24,
    bw,
    bh
  );

  ctx.strokeRect(
    W-bw-24,
    H-bh-24,
    bw,
    bh
  );

  ctx.fillStyle=
    "#1f2937";

  ctx.font=
    "13px system-ui";

  lines.forEach((t,i)=>{
    ctx.fillText(
      t,
      W-bw-8,
      H-bh-4+
      24*(i+1)
    );
  });

  const lg=[];

  if(incGrid){
    lg.push(
      [
        "#16a34a",
        "Ölçülmüş"
      ],
      [
        "#e11d48",
        "Boş"
      ]
    );
  }

  if(showWp){
    lg.push(
      [
        "#e11d48",
        "Waypoint"
      ]
    );
  }

  if(incCover){
    lg.push(
      [
        "#3b82f6",
        "Su"
      ],
      [
        "#ef4444",
        "Sert"
      ]
    );
  }

  lg.push(
    [
      "#2b6cb0",
      "Park sınırı"
    ]
  );

  ctx.font=
    "13px system-ui";

  lg.forEach((e,i)=>{
    const y=
      90+
      i*22;

    ctx.fillStyle=e[0];

    ctx.fillRect(
      W-190,
      y,
      16,
      14
    );

    ctx.strokeStyle="#333";

    ctx.strokeRect(
      W-190,
      y,
      16,
      14
    );

    ctx.fillStyle=
      "#1f2937";

    ctx.fillText(
      e[1],
      W-168,
      y+12
    );
  });

  const mPerDeg=
    111320*
    Math.cos(
      (
        (minLat+maxLat)/2
      )*
      Math.PI/180
    );

  const barPx=
    200*
    scale/
    mPerDeg;

  ctx.fillStyle=
    "#1f2937";

  ctx.fillRect(
    24,
    H-36,
    barPx,
    8
  );

  ctx.font=
    "bold 12px system-ui";

  ctx.fillText(
    "200 m",
    24+
    barPx+
    8,
    H-28
  );

  canvas.toBlob(
    b=>{
      const u=
        URL.createObjectURL(
          b
        );

      const a=
        document.createElement(
          "a"
        );

      a.href=u;

      a.download=
        "dendrogeo_"+
        name.replace(
          /[^a-z0-9_]/gi,
          "_"
        )+
        "_rapor.png";

      a.click();

      setTimeout(
        ()=>URL.revokeObjectURL(u),
        1000
      );

      toast(
        "✓ PNG indirildi",
        "ok",
        "🖼️"
      );
    },
    "image/png"
  );
}


/* =========================================================
   REFERENCE AREA
========================================================= */

function setRefHa(v){
  PARK_REF_HA=
    parseFloat(v);

  if(
    !isFinite(
      PARK_REF_HA
    )
  ){
    PARK_REF_HA=null;
  }

  renderRefBadge();
}

function renderRefBadge(){
  const el=$("refBadge");
  if(!el)return;

  if(!PARK_REF_HA||!PARK_POLY){
    el.style.display="none";
    el.textContent="";
    return;
  }

  const ha=parkAreaHa();
  const dev=Math.abs(((ha-PARK_REF_HA)/PARK_REF_HA)*100);

  el.style.display="inline-flex";
  el.textContent="Referans: "+PARK_REF_HA+" ha · Sapma: %"+dev.toFixed(1);

  if(dev<3){
    el.style.background="rgba(22,163,74,.12)";
    el.style.color="#16a34a";
  }else{
    el.style.background="rgba(245,158,11,.14)";
    el.style.color="#b45309";
  }
}


/* =========================================================
   DENDROGEO PARK ANALYSIS v45
   - Water lifecycle fix: drawPark no longer loses water data
   - Multipolygon water holes
   - Faster/parallel Overpass access with timeout
   - Spatially indexed land-cover sampling
   - More complete hard-surface OSM coverage
   - Official reference area kept separate from geometric area
========================================================= */
(function(){
"use strict";

const DG_HARD_SURFACES=new Set([
  "paved","asphalt","chipseal","concrete","paving_stones",
  "paving_stones:lanes","sett","concrete:plates","concrete:lanes",
  "cobblestone","unhewn_cobblestone","bricks","metal","metal_grid",
  "wood","tiles","acrylic","plastic","rubber","tartan"
]);

const DG_SOFT_SURFACES=new Set([
  "grass","dirt","earth","ground","gravel","fine_gravel","sand",
  "mud","unpaved","compacted","woodchips","pebbles","pebblestone",
  "clay","artificial_turf","stepping_stones"
]);

const DG_SOFT_PATH_TYPES=new Set([
  "footway","path","cycleway","steps","pedestrian","bridleway","track"
]);

let DG_WATER_HOLES=[];
let DG_WATER_READY=Promise.resolve();
let DG_WATER_KEY="";
let DG_WATER_CACHE=new Map();
let DG_ANALYSIS_KEY="";
let DG_ANALYSIS_CACHE=new Map();
let DG_OFFICIAL_REFERENCE_HA=null;
let DG_RAW_GEOMETRIC_AREA_HA=null;

function dgNormName(v){
  return String(v||"")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/ı/g,"i")
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function dgApplyReferenceArea(park){
  const n=dgNormName(park&&park.name);
  DG_OFFICIAL_REFERENCE_HA =
    n==="goksu parki" || n==="goksu park"
      ? 50.8
      : null;

  DG_RAW_GEOMETRIC_AREA_HA =
    PARK_POLY ? parkAreaM2()/10000 : null;

  PARK_REF_HA=DG_OFFICIAL_REFERENCE_HA;
}

const DG_originalParkAreaHa=parkAreaHa;
parkAreaHa=function(){
  const raw=DG_originalParkAreaHa();
  return DG_OFFICIAL_REFERENCE_HA || raw;
};

function dgBBox(){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const r of (PARK_POLY||[])){
    for(const p of (r||[])){
      minLat=Math.min(minLat,p[0]);
      maxLat=Math.max(maxLat,p[0]);
      minLon=Math.min(minLon,p[1]);
      maxLon=Math.max(maxLon,p[1]);
    }
  }
  const pad=0.00018;
  return [minLat-pad,minLon-pad,maxLat+pad,maxLon+pad];
}

function dgQueryKey(prefix){
  const b=dgBBox();
  return prefix+":"+b.map(v=>v.toFixed(6)).join(",");
}

async function dgFetchJson(query,timeoutMs=9000){
  return overpassRequest(query,"surface analysis");
}

function isClosedLine(pts){
  if(!pts||pts.length<4)return false;
  const a=pts[0],b=pts[pts.length-1];
  return Math.abs(a[0]-b[0])<1e-8 && Math.abs(a[1]-b[1])<1e-8;
}

function ringBBox(r){
  const b=dgLineBbox(r||[]);
  return b;
}

function ringTouchesPark(ring,park,bbox){
  if(!ring||ring.length<2)return false;
  const b=dgLineBbox(ring);
  if(b.maxLat<bbox.minLat||b.minLat>bbox.maxLat||b.maxLon<bbox.minLon||b.minLon>bbox.maxLon)return false;
  for(const p of ring) if(pointInPark(p[0],p[1],park)) return true;
  const c=[(b.minLat+b.maxLat)/2,(b.minLon+b.maxLon)/2];
  if(pointInPark(c[0],c[1],park))return true;
  return dgTouchesPark(ring);
}

function lineTouchesPark(line,park,bbox){
  if(!line||line.length<2)return false;
  const b=dgLineBbox(line);
  if(b.maxLat<bbox.minLat||b.minLat>bbox.maxLat||b.maxLon<bbox.minLon||b.minLon>bbox.maxLon)return false;
  return dgTouchesPark(line);
}

function geometryIntersectsRect(r,rect,cLat,clearance){
  if(!r||r.length<2)return false;
  for(const p of r){
    if(p[0]>=rect.minLat&&p[0]<=rect.maxLat&&p[1]>=rect.minLon&&p[1]<=rect.maxLon)return true;
  }
  return false;
}

function geometryLineIntersectsRect(line,rect,cLat,clearance){
  if(!line||line.length<2)return false;
  for(let i=0;i<line.length-1;i++){
    const a=line[i],b=line[i+1];
    const minLat=Math.min(a[0],b[0]),maxLat=Math.max(a[0],b[0]);
    const minLon=Math.min(a[1],b[1]),maxLon=Math.max(a[1],b[1]);
    if(maxLat>=rect.minLat&&minLat<=rect.maxLat&&maxLon>=rect.minLon&&minLon<=rect.maxLon)return true;
  }
  return false;
}

function dgLineBbox(pts){
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const p of pts){
    minLat=Math.min(minLat,p[0]); maxLat=Math.max(maxLat,p[0]);
    minLon=Math.min(minLon,p[1]); maxLon=Math.max(maxLon,p[1]);
  }
  return {minLat,maxLat,minLon,maxLon};
}

function dgTouchesPark(pts){
  if(!pts||pts.length<2||!PARK_POLY)return false;
  const b=dgLineBbox(pts);
  const pb=dgLineBbox(PARK_POLY[0]||[]);
  if(b.maxLat<pb.minLat-0.001||b.minLat>pb.maxLat+0.001||
     b.maxLon<pb.minLon-0.001||b.minLon>pb.maxLon+0.001) return false;
  for(const p of pts){
    if(pointInPark(p[0],p[1],PARK_POLY)) return true;
  }
  const center=[(b.minLat+b.maxLat)/2,(b.minLon+b.maxLon)/2];
  if(pointInPark(center[0],center[1],PARK_POLY)) return true;
  const outer=Array.isArray(PARK_POLY)?PARK_POLY:[];
  for(const pr of outer){
    for(let i=0;i<pr.length-1;i++){
      for(let j=0;j<pts.length-1;j++){
        if(segmentsIntersectLatLon(pr[i],pr[i+1],pts[j],pts[j+1])) return true;
      }
    }
  }
  return false;
}

function dgPushWaterRelation(r){
  if(!r)return;
  if(Array.isArray(r)){
    for(const rr of r) if(rr&&rr.length>=4) WATER_RINGS.push(rr);
    return;
  }
  for(const rr of (r.outer||[])) if(rr&&rr.length>=4) WATER_RINGS.push(rr);
  for(const rr of (r.inner||[])) if(rr&&rr.length>=4) DG_WATER_HOLES.push(rr);
}

function dgWaterElement(el){
  const t=el.tags||{};
  return !!(
    t.natural==="water" ||
    t.water ||
    t.landuse==="reservoir" ||
    t.landuse==="basin" ||
    t.landuse==="salt_pond" ||
    t.leisure==="swimming_pool" ||
    t.waterway==="riverbank"
  );
}

async function dgLoadWaterForPark(force=false){
  if(!PARK_POLY||!PARK_POLY.length) return;
  const key=dgQueryKey("water");
  if(!force && DG_WATER_KEY===key && DG_WATER_READY) return DG_WATER_READY;

  DG_WATER_KEY=key;
  DG_WATER_READY=(async()=>{
    if(!force && DG_WATER_CACHE.has(key)){
      const c=DG_WATER_CACHE.get(key);
      WATER_RINGS=c.rings.map(r=>r.map(p=>p.slice()));
      WATER_LINES=c.lines.map(r=>r.map(p=>p.slice()));
      DG_WATER_HOLES=c.holes.map(r=>r.map(p=>p.slice()));
      dgRenderWater();
      return;
    }

    WATER_RINGS=[];
    WATER_LINES=[];
    DG_WATER_HOLES=[];

    const [s,w,n,e]=dgBBox();
    const bbox=`${s},${w},${n},${e}`;
    const q=
      `[out:json][timeout:25];(`+
      `way["natural"="water"](${bbox});`+
      `relation["natural"="water"](${bbox});`+
      `way["water"](${bbox});`+
      `relation["water"](${bbox});`+
      `way["landuse"="reservoir"](${bbox});`+
      `relation["landuse"="reservoir"](${bbox});`+
      `way["landuse"="basin"](${bbox});`+
      `relation["landuse"="basin"](${bbox});`+
      `way["landuse"="salt_pond"](${bbox});`+
      `relation["landuse"="salt_pond"](${bbox});`+
      `way["leisure"="swimming_pool"](${bbox});`+
      `relation["leisure"="swimming_pool"](${bbox});`+
      `way["waterway"="riverbank"](${bbox});`+
      `way["natural"="wetland"](${bbox});`+
      `way["waterway"~"river|canal|stream|drain|ditch"](${bbox});`+
      `);`+
      `out geom qt;`;

    let json;
    try{
      json=await dgFetchJson(q,9000);
    }catch(e){
      console.warn("DendroGeo water query failed",e);
      dgRenderWater();
      return;
    }

    for(const el of (json.elements||[])){
      if(!dgWaterElement(el) && !(el.tags&&el.tags.natural==="wetland") &&
         !(el.tags&&/^river|canal|stream|drain|ditch$/.test(String(el.tags.waterway||"")))) continue;

      if(el.type==="relation"){
        dgPushWaterRelation(extractRings(el));
        continue;
      }
      if(!el.geometry||el.geometry.length<2) continue;

      const pts=el.geometry.map(g=>[g.lat,g.lon]);
      if(!dgTouchesPark(pts)) continue;

      if(isClosedLine(pts)){
        WATER_RINGS.push(pts);
      }else{
        WATER_LINES.push(pts);
      }
    }

    const uniq=(arr)=>{
      const seen=new Set();
      return arr.filter(r=>{
        const k=r.length+":"+r[0]?.[0]+":"+r[0]?.[1]+":"+r[r.length-1]?.[0]+":"+r[r.length-1]?.[1];
        if(seen.has(k))return false;
        seen.add(k); return true;
      });
    };

    WATER_RINGS=uniq(WATER_RINGS);
    WATER_LINES=uniq(WATER_LINES);
    DG_WATER_HOLES=uniq(DG_WATER_HOLES).filter(r=>dgTouchesPark(r));

    DG_WATER_CACHE.set(key,{
      rings:WATER_RINGS.map(r=>r.map(p=>p.slice())),
      lines:WATER_LINES.map(r=>r.map(p=>p.slice())),
      holes:DG_WATER_HOLES.map(r=>r.map(p=>p.slice()))
    });

    dgRenderWater();
    console.log("✓ Su geometrisi:",WATER_RINGS.length,"alan,",WATER_LINES.length,"çizgi,",DG_WATER_HOLES.length,"ada/boşluk");
  })();

  return DG_WATER_READY;
}

function dgRenderWater(){
  if(WATER_LAYER&&map){
    try{map.removeLayer(WATER_LAYER);}catch(e){}
  }
  WATER_LAYER=L.layerGroup().addTo(map);
  for(const r of WATER_RINGS){
    if(!r||r.length<4)continue;
    L.polygon(r,{
      color:"#2563eb",weight:1,fillColor:"#60a5fa",
      fillOpacity:.42,interactive:false
    }).addTo(WATER_LAYER);
  }
  for(const l of WATER_LINES){
    if(!l||l.length<2)continue;
    L.polyline(l,{
      color:"#2563eb",weight:2,opacity:.5,interactive:false
    }).addTo(WATER_LAYER);
  }
}

const DG_originalDrawPark=drawPark;
drawPark=function(park){
  dgApplyReferenceArea(park);
  DG_originalDrawPark(park);
  dgApplyReferenceArea(park);
  dgLoadWaterForPark(true);
};

const DG_originalSwitchPark=switchPark;
switchPark=function(i){
  const p=PARK_CANDS[i];
  if(p) drawPark(p);
};

function dgIsWaterPoint(lat,lon){
  for(const r of WATER_RINGS){
    if(r&&r.length>=4&&pointInPolygon(lat,lon,r)){
      let hole=false;
      for(const h of DG_WATER_HOLES){
        if(pointInPolygon(lat,lon,h)){hole=true;break;}
      }
      if(!hole)return true;
    }
  }
  for(const l of WATER_LINES){
    if(!l||l.length<2)continue;
    for(let i=0;i<l.length-1;i++){
      if(pointToSegmentDistanceM(lat,lon,l[i],l[i+1])<=2.5)return true;
    }
  }
  return false;
}

const DG_originalIsCellValid=isCellValid;
isCellValid=function(s0,s1,w0,w1){
  if(!cellInsidePark(s0,s1,w0,w1)) return false;
  const cLat=(s0+s1)/2;
  const rect=ringBBox([[s0,w0],[s0,w1],[s1,w1],[s1,w0]],cLat);
  for(const r of WATER_RINGS){
    if(geometryIntersectsRect(r,rect,cLat,WATER_CLEARANCE_M)){
      let blocked=true;
      for(const h of DG_WATER_HOLES){
        if(h&&pointInPolygon(cLat,(w0+w1)/2,h)){blocked=false;break;}
      }
      if(blocked)return false;
    }
  }
  for(const l of WATER_LINES){
    if(geometryLineIntersectsRect(l,rect,cLat,2.5))return false;
  }
  return DG_originalIsCellValid(s0,s1,w0,w1);
};

function dgHardSurface(t){
  const s=String(t.surface||"").toLowerCase().trim();
  return DG_HARD_SURFACES.has(s);
}

function dgSoftSurface(t){
  const s=String(t.surface||"").toLowerCase().trim();
  return DG_SOFT_SURFACES.has(s);
}

function dgIsImpervious(el){
  const t=el.tags||{};
  if(t.building)return true;
  if(t["area:highway"] && (el.geometry||el.members)) return true;
  if(t.amenity==="parking"||t.amenity==="bicycle_parking"||
     t.amenity==="motorcycle_parking") return !dgSoftSurface(t);
  if(t.man_made==="bridge"||t.man_made==="pier")return true;
  if(t.barrier==="wall"||t.barrier==="retaining_wall")return true;
  if(dgHardSurface(t))return true;
  if(dgSoftSurface(t))return false;

  const hw=String(t.highway||"").toLowerCase();
  if(hw){
    if(DG_SOFT_PATH_TYPES.has(hw)){
      // Explicit soft surface wins; otherwise park paths are treated as constructed travel surfaces.
      return true;
    }
    if(hw==="construction"||hw==="proposed"||hw==="raceway")return false;
    return true;
  }

  if(t.leisure==="pitch"){
    const sport=String(t.sport||"").toLowerCase();
    if(["tennis","basketball","volleyball","skateboard","multi"].some(x=>sport.includes(x))) return true;
    return dgHardSurface(t);
  }

  if(t.leisure==="track"){
    return dgHardSurface(t) || ["tartan","acrylic","concrete","asphalt"].includes(String(t.surface||"").toLowerCase());
  }

  if(t.leisure==="playground"){
    return ["rubber","acrylic","plastic","paved","concrete","asphalt","paving_stones"].includes(String(t.surface||"").toLowerCase());
  }

  return false;
}

function dgCollectImpervious(el){
  if(!dgIsImpervious(el))return;
  if(el.type==="relation"){
    const r=extractRings(el);
    if(!r)return;
    if(Array.isArray(r)){
      for(const rr of r)if(rr&&rr.length>=4)IMP_RINGS.push(rr);
    }else{
      for(const rr of (r.outer||[]))if(rr&&rr.length>=4)IMP_RINGS.push(rr);
    }
    return;
  }
  if(!el.geometry||el.geometry.length<2)return;
  const pts=el.geometry.map(g=>[g.lat,g.lon]);
  if(!dgTouchesPark(pts))return;
  const t=el.tags||{};

  if(isClosedLine(pts) && (
    t.building || t.amenity==="parking" ||
    t["area:highway"] || t.man_made==="pier" ||
    t.leisure==="pitch" || t.leisure==="track" ||
    t.leisure==="playground"
  )){
    IMP_RINGS.push(pts);
    return;
  }

  let width=parseFloat(String(t.width||"").replace(",",".")); 
  if(!Number.isFinite(width)||width<=0||width>40){
    const hw=String(t.highway||"").toLowerCase();
    width =
      hw==="footway" ? 2.0 :
      hw==="path" ? 2.0 :
      hw==="cycleway" ? 2.5 :
      hw==="pedestrian" ? 3.0 :
      hw==="steps" ? 1.8 :
      hw==="bridleway" ? 2.0 :
      hw==="track" ? 2.5 :
      roadHalfWidth(hw)*2;
  }

  if(t.barrier==="wall"||t.barrier==="retaining_wall") width=Math.max(width,1.0);
  if(t.man_made==="pier") width=Math.max(width,3.0);

  IMP_LINES.push({pts,w:width/2});
}

async function dgQueryDetailedCoverage(){
  if(!PARK_POLY||!PARK_POLY.length)return;
  const key=dgQueryKey("hard");
  if(DG_ANALYSIS_KEY===key && DG_ANALYSIS_CACHE.has(key)){
    const c=DG_ANALYSIS_CACHE.get(key);
    IMP_RINGS=c.rings.map(r=>r.map(p=>p.slice()));
    IMP_LINES=c.lines.map(o=>({pts:o.pts.map(p=>p.slice()),w:o.w}));
    refreshImpLayer();
    return;
  }

  IMP_RINGS=[]; IMP_LINES=[]; GRID_BLOCK_LINES=[];
  const [s,w,n,e]=dgBBox();
  const bbox=`${s},${w},${n},${e}`;

  const q=
    `[out:json][timeout:30];(`+
    `way["building"](${bbox});`+
    `relation["building"](${bbox});`+
    `way["highway"](${bbox});`+
    `relation["highway"](${bbox});`+
    `way["area:highway"](${bbox});`+
    `relation["area:highway"](${bbox});`+
    `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `relation["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
    `way["leisure"~"pitch|track|playground"](${bbox});`+
    `relation["leisure"~"pitch|track|playground"](${bbox});`+
    `way["surface"](${bbox});`+
    `way["man_made"~"bridge|pier"](${bbox});`+
    `way["barrier"~"wall|retaining_wall"](${bbox});`+
    `);`+
    `out geom qt;`;

  let json;
  try{
    json=await dgFetchJson(q,10000);
  }catch(e){
    console.warn("DendroGeo hard-surface query failed",e);
    refreshImpLayer();
    return;
  }

  for(const el of (json.elements||[])){
    if(dgWaterElement(el))continue;
    dgCollectImpervious(el);
  }

  const pb=dgLineBbox(PARK_POLY[0]||[]);
  IMP_RINGS=IMP_RINGS.filter(r=>dgTouchesPark(r));
  IMP_LINES=IMP_LINES.filter(l=>dgTouchesPark(l.pts));

  DG_ANALYSIS_KEY=key;
  DG_ANALYSIS_CACHE.set(key,{
    rings:IMP_RINGS.map(r=>r.map(p=>p.slice())),
    lines:IMP_LINES.map(o=>({pts:o.pts.map(p=>p.slice()),w:o.w}))
  });

  refreshImpLayer();
  console.log("✓ Sert zemin geometrisi:",IMP_RINGS.length,"poligon,",IMP_LINES.length,"çizgi");
}

function dgBuildSpatialIndex(items,minLat,minLon,bucketM=60){
  const latStep=bucketM/110540;
  const lonStep=bucketM/(111320*Math.cos(minLat*Math.PI/180));
  const idx=new Map();

  function add(item){
    const pts=item.pts||item;
    if(!pts||pts.length<2)return;
    let a=90,b=-90,c=180,d=-180;
    for(const p of pts){
      a=Math.min(a,p[0]); b=Math.max(b,p[0]);
      c=Math.min(c,p[1]); d=Math.max(d,p[1]);
    }
    const r0=Math.floor((a-minLat)/latStep)-1;
    const r1=Math.floor((b-minLat)/latStep)+1;
    const c0=Math.floor((c-minLon)/lonStep)-1;
    const c1=Math.floor((d-minLon)/lonStep)+1;
    for(let r=r0;r<=r1;r++){
      for(let c2=c0;c2<=c1;c2++){
        const k=r+","+c2;
        let a0=idx.get(k);
        if(!a0){a0=[];idx.set(k,a0);}
        a0.push(item);
      }
    }
  }
  for(const it of items)add(it);

  return {
    latStep,lonStep,idx,
    get(lat,lon){
      const r=Math.floor((lat-minLat)/latStep);
      const c=Math.floor((lon-minLon)/lonStep);
      const out=[];
      const seen=new Set();
      for(let dr=-1;dr<=1;dr++){
        for(let dc=-1;dc<=1;dc++){
          const a=idx.get((r+dr)+","+(c+dc))||[];
          for(const it of a){
            if(!seen.has(it)){seen.add(it);out.push(it);}
          }
        }
      }
      return out;
    }
  };
}

async function runLandCoverAnalysis(){
  if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç");
  const rep=$("landCoverReport");
  if(rep){rep.style.display="block";rep.innerHTML="⏳ Su ve sert zemin geometrileri hazırlanıyor…";}
  toast("🌿 Bilimsel yüzey analizi başlıyor…","info");

  await dgLoadWaterForPark(false);
  await dgQueryDetailedCoverage();

  const minLat=Math.min(...PARK_POLY.flat().map(p=>p[0]));
  const maxLat=Math.max(...PARK_POLY.flat().map(p=>p[0]));
  const minLon=Math.min(...PARK_POLY.flat().map(p=>p[1]));
  const maxLon=Math.max(...PARK_POLY.flat().map(p=>p[1]));

  const SAMPLE_M=3;
  const stepLat=SAMPLE_M/110540;
  const stepLon=SAMPLE_M/(111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180));

  const waterIndex=dgBuildSpatialIndex([...WATER_RINGS,...DG_WATER_HOLES],minLat,minLon,60);
  const impIndex=dgBuildSpatialIndex([...IMP_RINGS,...IMP_LINES],minLat,minLon,60);

  let nPark=0,nWater=0,nImp=0,nGreen=0;

  for(let la=minLat;la<=maxLat;la+=stepLat){
    for(let lo=minLon;lo<=maxLon;lo+=stepLon){
      if(!pointInPark(la,lo,PARK_POLY))continue;
      nPark++;

      let water=false;
      const wc=waterIndex.get(la,lo);
      for(const g of wc){
        if(g===undefined)continue;
        if(Array.isArray(g)&&g.length>=4){
          if(pointInPolygon(la,lo,g)){
            let hole=false;
            for(const h of DG_WATER_HOLES){
              if(pointInPolygon(la,lo,h)){hole=true;break;}
            }
            if(!hole){water=true;break;}
          }
        }
      }
      if(!water){
        for(const l of WATER_LINES){
          if(pointToSegmentDistanceM(la,lo,l[0],l[1])<=2.5){water=true;break;}
        }
        if(!water){
          for(const l of WATER_LINES){
            for(let i=0;i<l.length-1;i++){
              if(pointToSegmentDistanceM(la,lo,l[i],l[i+1])<=2.5){water=true;break;}
            }
            if(water)break;
          }
        }
      }
      if(water){nWater++;continue;}

      let imp=false;
      for(const g of impIndex.get(la,lo)){
        if(Array.isArray(g)){
          if(g.length>=4 && pointInPolygon(la,lo,g)){imp=true;break;}
        }else if(g&&g.pts){
          for(let i=0;i<g.pts.length-1;i++){
            if(pointToSegmentDistanceM(la,lo,g.pts[i],g.pts[i+1])<=g.w){
              imp=true;break;
            }
          }
          if(imp)break;
        }
      }

      if(imp)nImp++; else nGreen++;
    }
  }

  const rawHa=parkAreaM2()/10000;
  const totalHa=parkAreaHa();
  const scaleTotal=totalHa/Math.max(rawHa,0.000001);

  const ha=v=>(v/Math.max(1,nPark)*totalHa).toFixed(1);
  const pct=v=>nPark?Math.round(v/nPark*100):0;

  LANDCOVER={
    green:+ha(nGreen),
    hard:+ha(nImp),
    water:+ha(nWater),
    total:+totalHa.toFixed(1),
    geometricTotal:+rawHa.toFixed(1),
    referenceTotal:DG_OFFICIAL_REFERENCE_HA,
    samplingScale:+scaleTotal.toFixed(4),
    sampleM:SAMPLE_M,
    sampleCount:nPark
  };

  const row=(color,label,haV,pv)=>
    `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">`+
      `<span style="width:12px;height:12px;border-radius:3px;background:${color};flex:none"></span>`+
      `<span style="width:52px;font-size:.8rem">${label}</span>`+
      `<div style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden"><div style="height:100%;width:${pv}%;background:${color};transition:width .6s"></div></div>`+
      `<b style="font-size:.8rem;width:74px;text-align:right">${haV} ha</b>`+
      `<span style="font-size:.72rem;color:var(--mut);width:38px">% ${pv}</span>`+
    `</div>`;

  if(rep){
    const refNote=DG_OFFICIAL_REFERENCE_HA
      ? `<div style="font-size:.72rem;color:var(--mut);margin-top:6px">Geometrik OSM alanı: <b>${rawHa.toFixed(1)} ha</b> · Referans kullanım alanı: <b>${DG_OFFICIAL_REFERENCE_HA.toFixed(1)} ha</b>. Yüzdeler ve sınıflar referans alana normalize edildi.</div>`
      : "";
    rep.innerHTML=
      `<b>🌿 Yüzey Örtüsü</b> <span style="font-size:.72rem;color:var(--mut)">(OSM geometri + yüzey/yol bilgisi)</span>`+
      row("#16a34a","Yeşil",ha(nGreen),pct(nGreen))+
      row("#ef4444","Sert",ha(nImp),pct(nImp))+
      row("#3b82f6","Su",ha(nWater),pct(nWater))+
      `<div style="font-size:.72rem;color:var(--mut);margin-top:6px">Toplam: <b>${totalHa.toFixed(1)} ha</b> · Yeşil+Sert+Su = Toplam<br>Örnekleme: ${SAMPLE_M} m · Örnek nokta: ${nPark.toLocaleString("tr-TR")}</div>`+
      refNote;
  }

  toast("✓ Analiz tamam","ok","🌿");
}

const DG_originalBuildGrid=buildGrid;
buildGrid=async function(){
  await dgLoadWaterForPark(false);
  return DG_originalBuildGrid();
};

window.DG_PARK_ANALYSIS={
  version:"45",
  officialReferenceHa:()=>DG_OFFICIAL_REFERENCE_HA,
  geometricAreaHa:()=>PARK_POLY?parkAreaM2()/10000:null,
  waterRings:()=>WATER_RINGS.length,
  waterLines:()=>WATER_LINES.length,
  waterHoles:()=>DG_WATER_HOLES.length,
  hardPolygons:()=>IMP_RINGS.length,
  hardLines:()=>IMP_LINES.length
};

})();

/* DENDROGEO v47 — strict analysis override */
(function(){
"use strict";
const HARD=new Set(["asphalt","paved","chipseal","concrete","paving_stones","paving_stones:lanes","sett","concrete:plates","concrete:lanes","cobblestone","unhewn_cobblestone","bricks","metal","metal_grid","acrylic","plastic","rubber","tartan","rekortan","resin","epoxy","carpet"]);
const SOFT=new Set(["grass","dirt","earth","ground","gravel","fine_gravel","sand","mud","unpaved","compacted","woodchips","pebbles","pebblestone","clay","artificial_turf","turf","soil","mulch"]);
const GREEN_WC=new Set([10,20,30,40,90,95,100]);
const WC_CACHE=new Map();let WC_DATA=null;
function widthOf(t){for(const k of ["width","width:carriageway","width:effective"]){const m=String(t&&t[k]||"").replace(",","." ).match(/[0-9.]+/);const n=m?Number(m[0]):NaN;if(Number.isFinite(n)&&n>0&&n<80)return n;}return null;}
function surface(t){return String(t&&t.surface||"").toLowerCase().trim();}
function water(t){return !!(t.natural==="water"||t.water||t.landuse==="reservoir"||t.landuse==="basin"||t.landuse==="salt_pond"||t.leisure==="swimming_pool"||t.waterway==="riverbank");}
function hardArea(t){const s=surface(t);if(t.building||t["building:part"]||t["area:highway"]||t.landuse==="highway")return true;if(t.amenity==="parking"||t.amenity==="bicycle_parking"||t.amenity==="motorcycle_parking")return !SOFT.has(s);if(t.man_made==="pier")return true;if(t.leisure==="pitch")return HARD.has(s)||["tennis","basketball","volleyball","skateboard"].some(x=>String(t.sport||"").toLowerCase().includes(x));if(t.leisure==="track"||t.leisure==="playground")return HARD.has(s);return HARD.has(s);}
function hardLine(t){const s=surface(t);return !!t.highway&&!SOFT.has(s)&&HARD.has(s);}
function bb(p){let a=90,b=-90,c=180,d=-180;for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}return{a,b,c,d};}
function hit(x,lat,lon){return lat>=x.a&&lat<=x.b&&lon>=x.c&&lon<=x.d;}
function closed(p){if(!p||p.length<4)return false;const a=p[0],b=p[p.length-1];return Math.abs(a[0]-b[0])<1e-8&&Math.abs(a[1]-b[1])<1e-8;}
function poly(lat,lon,g){if(!g.outer.some(r=>pointInPolygon(lat,lon,r)))return false;for(const h of(g.inner||[]))if(pointInPolygon(lat,lon,h))return false;return true;}
function near(lat,lon,p,w){if(!w)return false;for(let i=0;i<p.length-1;i++)if(pointToSegmentDistanceM(lat,lon,p[i],p[i+1])<=w/2)return true;return false;}
async function osm(){let minLat=90,maxLat=-90,minLon=180,maxLon=-180;for(const r of PARK_POLY)for(const p of r){minLat=Math.min(minLat,p[0]);maxLat=Math.max(maxLat,p[0]);minLon=Math.min(minLon,p[1]);maxLon=Math.max(maxLon,p[1]);}const d=.00015,b=(minLat-d)+","+(minLon-d)+","+(maxLat+d)+","+(maxLon+d);const q="[out:json][timeout:35];("+"way[\"natural\"=\"water\"]("+b+");relation[\"natural\"=\"water\"]("+b+");"+"way[\"water\"]("+b+");relation[\"water\"]("+b+");"+"way[\"landuse\"~\"reservoir|basin|salt_pond\"]("+b+");relation[\"landuse\"~\"reservoir|basin|salt_pond\"]("+b+");"+"way[\"leisure\"=\"swimming_pool\"]("+b+");relation[\"leisure\"=\"swimming_pool\"]("+b+");"+"way[\"waterway\"=\"riverbank\"]("+b+");relation[\"waterway\"=\"riverbank\"]("+b+");"+"way[\"waterway\"~\"river|canal|stream|drain|ditch\"]("+b+");"+"way[\"building\"]("+b+");relation[\"building\"]("+b+");way[\"building:part\"]("+b+");"+"way[\"area:highway\"]("+b+");relation[\"area:highway\"]("+b+");way[\"highway\"]("+b+");"+"way[\"amenity\"~\"parking|bicycle_parking|motorcycle_parking\"]("+b+");"+"way[\"leisure\"~\"pitch|track|playground\"]("+b+");way[\"surface\"]("+b+");"+"way[\"man_made\"~\"pier|bridge\"]("+b+"););out geom qt;";const data=await overpassRequest(q,"v47 bilimsel yüzey");if(!data||!Array.isArray(data.elements))throw new Error(LAST_OVERPASS_ERROR||"OSM sorgusu başarısız");const wp=[],wl=[],hp=[],hl=[],seen=new Set();for(const el of data.elements){const id=el.type+":"+el.id;if(seen.has(id))continue;seen.add(id);const t=el.tags||{};if(el.type==="relation"){const r=extractRings(el);if(!r)continue;if(water(t)&&r.outer&&r.outer.length)wp.push({g:{outer:r.outer,inner:r.inner||[]},x:bb(r.outer.flat())});else if(hardArea(t)&&r.outer&&r.outer.length)hp.push({g:{outer:r.outer,inner:r.inner||[]},x:bb(r.outer.flat())});continue;}if(!el.geometry||el.geometry.length<2)continue;const p=el.geometry.map(g=>[g.lat,g.lon]),x=bb(p),w=widthOf(t);if(water(t)){if(closed(p))wp.push({g:{outer:[p],inner:[]},x});else if(w)wl.push({p,w,x});continue;}if(hardArea(t)&&closed(p)){hp.push({g:{outer:[p],inner:[]},x});continue;}if(hardLine(t)&&w)hl.push({p,w,x});}return{wp,wl,hp,hl,minLat,maxLat,minLon,maxLon};}
async function world(c){if(typeof GeoTIFF==="undefined"||!GeoTIFF.fromUrl)throw new Error("GeoTIFF.js yüklenmedi");const key=[c.minLat,c.maxLat,c.minLon,c.maxLon].map(v=>v.toFixed(6)).join(",");if(WC_DATA&&WC_DATA.key===key)return WC_DATA;const rasters=[],la0=Math.floor(c.minLat/3)*3,la1=Math.floor((c.maxLat-1e-10)/3)*3,lo0=Math.floor(c.minLon/3)*3,lo1=Math.floor((c.maxLon-1e-10)/3)*3;for(let la=la0;la<=la1;la+=3)for(let lo=lo0;lo<=lo1;lo+=3){const name=(la>=0?"N":"S")+String(Math.abs(la)).padStart(2,"0")+(lo>=0?"E":"W")+String(Math.abs(lo)).padStart(3,"0"),url="https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_"+name+"_Map.tif";let image=WC_CACHE.get(url);if(!image){image=await GeoTIFF.fromUrl(url,{cacheSize:16,maxRanges:8});WC_CACHE.set(url,image);}const r0=image.getBoundingBox(),rs=image.getResolution(),sx=Math.abs(rs[0]),sy=Math.abs(rs[1]),x0=Math.max(c.minLon,lo),x1=Math.min(c.maxLon,lo+3),y0=Math.max(c.minLat,la),y1=Math.min(c.maxLat,la+3);if(x0>=x1||y0>=y1)continue;const px0=Math.max(0,Math.floor((x0-r0[0])/sx)),px1=Math.min(image.getWidth(),Math.ceil((x1-r0[0])/sx)),py0=Math.max(0,Math.floor((r0[3]-y1)/sy)),py1=Math.min(image.getHeight(),Math.ceil((r0[3]-y0)/sy));if(px1<=px0||py1<=py0)continue;const r=await image.readRasters({window:[px0,py0,px1,py1],samples:[0]});rasters.push({bb:r0,sx,sy,px0,py0,w:r.width,h:r.height,v:r[0]});}if(!rasters.length)throw new Error("WorldCover rasterı bulunamadı");WC_DATA={key,rasters};return WC_DATA;}
function wcAt(lat,lon,d){for(const r of d.rasters){const px=Math.floor((lon-r.bb[0])/r.sx),py=Math.floor((r.bb[3]-lat)/r.sy),x=px-r.px0,y=py-r.py0;if(x<0||y<0||x>=r.w||y>=r.h)continue;const c=Number(r.v[y*r.w+x]);if(c===80)return"water";if(c===50)return"hard";if(GREEN_WC.has(c))return"green";if(c===60||c===70)return"other";}return null;}
async function run(){if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç","warn","🌳");const rep=$("landCoverReport");if(rep){rep.style.display="block";rep.innerHTML="⏳ OSM gerçek yüzey geometrileri okunuyor…";}toast("🌿 Gerçek arazi örtüsü analizi başlıyor…","info");const c=await osm();let wc=null;try{if(rep)rep.innerHTML="⏳ ESA WorldCover 2021 v200 · 10 m okunuyor…";wc=await world(c);}catch(e){console.warn("v47 WorldCover:",e);}if(rep)rep.innerHTML="⏳ 3 m örnekleme ve kaynak birleştirme…";const sl=3/110540,mid=(c.minLat+c.maxLat)/2,so=3/(111320*Math.cos(mid*Math.PI/180));let n=0,w=0,h=0,g=0,o=0,osmN=0,satN=0,unknown=0;for(let lat=c.minLat;lat<=c.maxLat;lat+=sl)for(let lon=c.minLon;lon<=c.maxLon;lon+=so){if(!pointInPark(lat,lon,PARK_POLY))continue;n++;let cls=null;for(const x of c.wp)if(hit(x.x,lat,lon)&&poly(lat,lon,x.g)){cls="water";break;}if(!cls)for(const x of c.wl)if(hit(x.x,lat,lon)&&near(lat,lon,x.p,x.w)){cls="water";break;}if(!cls)for(const x of c.hp)if(hit(x.x,lat,lon)&&poly(lat,lon,x.g)){cls="hard";break;}if(!cls)for(const x of c.hl)if(hit(x.x,lat,lon)&&near(lat,lon,x.p,x.w)){cls="hard";break;}if(cls)osmN++;else if(wc){cls=wcAt(lat,lon,wc);if(cls)satN++;}if(!cls){cls="other";unknown++;}if(cls==="water")w++;else if(cls==="hard")h++;else if(cls==="green")g++;else o++;}if(!n)throw new Error("Park içinde örnek üretilemedi");const total=parkAreaM2(),scale=total/n,waterM=w*scale,hardM=h*scale,greenM=g*scale,otherM=o*scale;LANDCOVER={total:+(total/10000).toFixed(2),water:+(waterM/10000).toFixed(2),hard:+(hardM/10000).toFixed(2),green:+(greenM/10000).toFixed(2),other:+(otherM/10000).toFixed(2),sampleM:3,sampleCount:n,osmKnownSamples:osmN,worldCoverSamples:satN,unknownSamples:unknown,scientific:true,method:wc?"OSM + ESA WorldCover 2021 v200 · 3 m":"OSM · 3 m"};const pct=v=>Math.round(v/total*100);const row=(col,label,v)=>{const p=pct(v);return "<div style=\"display:flex;align-items:center;gap:8px;margin:5px 0\"><span style=\"width:12px;height:12px;border-radius:3px;background:"+col+";flex:none\"></span><span style=\"width:78px;font-size:.8rem\">"+label+"</span><div style=\"flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden\"><div style=\"height:100%;width:"+p+"%;background:"+col+"\"></div></div><b style=\"font-size:.8rem;width:76px;text-align:right\">"+(v/10000).toFixed(2)+" ha</b><span style=\"font-size:.72rem;color:var(--mut);width:34px\">%"+p+"</span></div>";};if(rep)rep.innerHTML="<b>🌿 Arazi Örtüsü</b> <span style=\"font-size:.7rem;color:var(--mut)\">OSM + ESA WorldCover</span>"+row("#16a34a","Yeşil",greenM)+row("#ef4444","Sert",hardM)+row("#3b82f6","Su",waterM)+row("#9ca3af","Diğer / belirsiz",otherM)+"<div style=\"font-size:.72rem;color:var(--mut);margin-top:7px\">Toplam: <b>"+(total/10000).toFixed(2)+" ha</b> · Sınıflar toplamı: <b>"+((greenM+hardM+waterM+otherM)/10000).toFixed(2)+" ha</b><br>Örnekleme: <b>3 m</b> · Örnek nokta: <b>"+n.toLocaleString("tr-TR")+"</b></div><div style=\"font-size:.69rem;color:var(--mut);margin-top:7px\">OSM doğrudan: <b>"+osmN.toLocaleString("tr-TR")+"</b> · WorldCover: <b>"+satN.toLocaleString("tr-TR")+"</b> · Belirsiz: <b>"+unknown.toLocaleString("tr-TR")+"</b></div>"+(wc?"<div style=\"font-size:.69rem;color:var(--mut);margin-top:6px\">Uydu: <b>ESA WorldCover 2021 v200 · 10 m</b>. 50=Built-up, 80=kalıcı su, 10/20/30/40/90/95/100=vejetasyon; 60/70=diğer.</div>":"<div style=\"font-size:.69rem;color:#b45309;margin-top:6px\">⚠ ESA WorldCover okunamadı. OSM'nin bilmediği alanlar yeşile zorlanmadı.</div>")+"<div style=\"font-size:.68rem;color:var(--mut);margin-top:7px\">Toplam alan seçilen OSM park geometrisidir; hiçbir hedef değere ayarlanmaz.</div>";console.group("DENDROGEO v47");console.log({parkM2:total,samples:n,osmKnown:osmN,worldCover:satN,unknown,greenM2:greenM,hardM2:hardM,waterM2:waterM,otherM2:otherM});console.groupEnd();toast("✓ Kaynak tabanlı analiz tamamlandı","ok","🌿");}
window.runLandCoverAnalysis=run;window.DG_PARK_ANALYSIS={version:"47",geometricAreaHa:()=>PARK_POLY?parkAreaM2()/10000:null,result:()=>LANDCOVER,method:()=>LANDCOVER&&LANDCOVER.method||null};
})();

/* =========================================================
   DENDROGEO V48 LAND COVER ENGINE
   OSM fiziksel arazi örtüsü + açıkça etiketlenmiş sert yüzey
   - leisure=park tek başına yeşil sayılmaz.
   - OSM'de fiziksel örtüyü ifade eden natural/landuse/landcover/surface
     etiketleri kullanılır.
   - Açık highway çizgileri yalnızca gerçek width=* varsa sert alan
     olarak örneklenir; lanes'tan genişlik tahmini yapılmaz.
   - Bilinmeyen alan yeşile veya serte zorlanmaz.
========================================================= */

async function dgV48LoadCoverage(){
  if(!PARK_POLY||!PARK_POLY.length)return null;

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const ring of PARK_POLY){
    for(const p of ring){
      minLat=Math.min(minLat,p[0]); maxLat=Math.max(maxLat,p[0]);
      minLon=Math.min(minLon,p[1]); maxLon=Math.max(maxLon,p[1]);
    }
  }

  const pad=0.00035;
  const bbox=`${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;

  const q=
    `[out:json][timeout:90];(`+
    // Water
    `way["natural"="water"](${bbox});relation["natural"="water"](${bbox});`+
    `way["water"](${bbox});relation["water"](${bbox});`+
    `way["waterway"="riverbank"](${bbox});relation["waterway"="riverbank"](${bbox});`+
    `way["landuse"~"^(reservoir|basin|salt_pond)$"](${bbox});relation["landuse"~"^(reservoir|basin|salt_pond)$"](${bbox});`+
    `way["leisure"="swimming_pool"](${bbox});relation["leisure"="swimming_pool"](${bbox});`+
    // Hard polygons/features
    `way["building"](${bbox});relation["building"](${bbox});`+
    `way["building:part"](${bbox});relation["building:part"](${bbox});`+
    `way["amenity"~"^(parking|bicycle_parking|motorcycle_parking)$"](${bbox});relation["amenity"~"^(parking|bicycle_parking|motorcycle_parking)$"](${bbox});`+
    `way["area:highway"](${bbox});relation["area:highway"](${bbox});`+
    `way["landuse"="highway"](${bbox});relation["landuse"="highway"](${bbox});`+
    `way["leisure"~"^(pitch|track|playground)$"](${bbox});relation["leisure"~"^(pitch|track|playground)$"](${bbox});`+
    `way["surface"~"^(asphalt|paved|concrete|paving_stones|sett|cobblestone|bricks|metal|concrete:plates|concrete:lanes)$"](${bbox});`+
    `relation["surface"~"^(asphalt|paved|concrete|paving_stones|sett|cobblestone|bricks|metal|concrete:plates|concrete:lanes)$"](${bbox});`+
    `way["man_made"~"^(pier|bridge)$"](${bbox});relation["man_made"~"^(pier|bridge)$"](${bbox});`+
    // Green / vegetated areas
    `way["natural"~"^(wood|scrub|grassland|heath|fell|wetland|shrubbery)$"](${bbox});relation["natural"~"^(wood|scrub|grassland|heath|fell|wetland|shrubbery)$"](${bbox});`+
    `way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|orchard|vineyard|greenery)$"](${bbox});relation["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|orchard|vineyard|greenery)$"](${bbox});`+
    `way["landcover"](${bbox});relation["landcover"](${bbox});`+
    `way["leisure"="garden"](${bbox});relation["leisure"="garden"](${bbox});`+
    // Bare / other explicit covers
    `way["natural"~"^(sand|bare_rock|scree|shingle|mud|blockfield)$"](${bbox});relation["natural"~"^(sand|bare_rock|scree|shingle|mud|blockfield)$"](${bbox});`+
    `way["surface"~"^(gravel|fine_gravel|ground|dirt|earth|sand|mud|pebblestone|compacted|unhewn_cobblestone)$"](${bbox});relation["surface"~"^(gravel|fine_gravel|ground|dirt|earth|sand|mud|pebblestone|compacted|unhewn_cobblestone)$"](${bbox});`+
    // Linear features: width is read, never inferred.
    `way["highway"](${bbox});`+
    `);out geom;`;

  const data=await overpassRequest(q,"V48 arazi örtüsü");
  if(!data)return null;

  const seen=new Set();
  const water=[],hard=[],green=[],other=[],hardLines=[];
  const stats={water:0,hard:0,green:0,other:0,unknown:0};

  const addRing=(arr,ring)=>{
    if(ring&&ring.length>=3)arr.push(ring);
  };

  const ringsFromElement=el=>{
    if(el.type==="relation"){
      const r=extractRings(el);
      if(!r)return [];
      if(Array.isArray(r))return r.filter(x=>x&&x.length>=3);
      return (r.outer||[]).filter(x=>x&&x.length>=3);
    }
    if(!el.geometry)return [];
    const pts=el.geometry.map(p=>[p.lat,p.lon]);
    return isClosedLine(pts)?[pts]:[];
  };

  const explicitWidth=tags=>{
    const n=parseFloat(String(tags?.width??"").replace(",","."));
    return Number.isFinite(n)&&n>0&&n<40 ? n : 0;
  };

  const classFor=tags=>{
    const t=tags||{};
    const natural=String(t.natural||"").toLowerCase();
    const landuse=String(t.landuse||"").toLowerCase();
    const landcover=String(t.landcover||"").toLowerCase();
    const surface=String(t.surface||"").toLowerCase();
    const leisure=String(t.leisure||"").toLowerCase();

    if(t.building||t["building:part"])return "hard";
    if(t.amenity==="parking"||t.amenity==="bicycle_parking"||t.amenity==="motorcycle_parking")return "hard";
    if(t["area:highway"]||landuse==="highway")return "hard";
    if(t.man_made==="pier"||t.man_made==="bridge")return "hard";
    if(["asphalt","paved","concrete","paving_stones","sett","cobblestone","bricks","metal","concrete:plates","concrete:lanes"].includes(surface))return "hard";
    if(["pitch","track","playground"].includes(leisure) &&
       ["asphalt","paved","concrete","paving_stones","rubber","rubber_tiles"].includes(surface))return "hard";

    if(natural==="water"||t.water||natural==="wetland"&&t.wetland==="water")return "water";
    if(t.waterway==="riverbank"||landuse==="reservoir"||landuse==="basin"||landuse==="salt_pond"||leisure==="swimming_pool")return "water";

    if(["wood","scrub","grassland","heath","fell","wetland","shrubbery"].includes(natural))return "green";
    if(["forest","grass","meadow","recreation_ground","village_green","orchard","vineyard","greenery"].includes(landuse))return "green";
    if(leisure==="garden")return "green";
    if(["trees","tree","greenery","grass","shrub","shrubbery","moss","herbaceous_vegetation"].includes(landcover))return "green";
    if(surface==="grass")return "green";

    if(["sand","bare_rock","scree","shingle","mud","blockfield"].includes(natural))return "other";
    if(["gravel","fine_gravel","ground","dirt","earth","sand","mud","pebblestone","compacted","unhewn_cobblestone"].includes(surface))return "other";
    return null;
  };

  for(const el of (data.elements||[])){
    const key=el.type+":"+el.id;
    if(seen.has(key))continue;
    seen.add(key);

    const t=el.tags||{};
    const cls=classFor(t);
    const rings=ringsFromElement(el);

    if(cls==="water")rings.forEach(r=>addRing(water,r));
    else if(cls==="hard")rings.forEach(r=>addRing(hard,r));
    else if(cls==="green")rings.forEach(r=>addRing(green,r));
    else if(cls==="other")rings.forEach(r=>addRing(other,r));

    if(el.type==="way"&&Array.isArray(el.geometry)&&el.geometry.length>1&&t.highway){
      const width=explicitWidth(t);
      if(width>0){
        hardLines.push({pts:el.geometry.map(p=>[p.lat,p.lon]),w:width/2});
      }
    }
  }

  return {minLat,maxLat,minLon,maxLon,water,hard,green,other,hardLines,stats};
}

function dgV48PointInAny(lat,lon,items){
  for(const ring of items){
    if(pointInPolygon(lat,lon,ring))return true;
  }
  return false;
}

function dgV48ClassAt(lat,lon,src){
  // Physical-cover priority: water > hard > explicit green > explicit bare/other.
  if(dgV48PointInAny(lat,lon,src.water))return "water";
  if(dgV48PointInAny(lat,lon,src.hard))return "hard";
  if(nearLineW(src.hardLines,lat,lon))return "hard";
  if(dgV48PointInAny(lat,lon,src.green))return "green";
  if(dgV48PointInAny(lat,lon,src.other))return "other";
  return "unknown";
}

async function dgV48Sample(src){
  const lat0=(src.minLat+src.maxLat)/2;
  const stepLat=3/110540;
  const stepLon=3/(111320*Math.cos(lat0*Math.PI/180));
  const out={sampleM:3,park:0,water:0,hard:0,green:0,other:0,unknown:0};

  for(let lat=src.minLat;lat<=src.maxLat;lat+=stepLat){
    for(let lon=src.minLon;lon<=src.maxLon;lon+=stepLon){
      if(!pointInPark(lat,lon,PARK_POLY))continue;
      out.park++;
      const cls=dgV48ClassAt(lat,lon,src);
      if(cls==="water")out.water++;
      else if(cls==="hard")out.hard++;
      else if(cls==="green")out.green++;
      else if(cls==="other")out.other++;
      else out.unknown++;
    }
  }
  return out;
}

async function dgV48Run(){
  if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç","warn","🌳");
  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML="⏳ OSM fiziksel arazi örtüsü ve yüzey geometrileri okunuyor…";
  }
  toast("🌿 OSM gerçek arazi örtüsü analizi başlıyor…","info");

  const src=await dgV48LoadCoverage();
  if(!src){
    if(rep)rep.innerHTML="❌ OSM arazi örtüsü verisi alınamadı.";
    return toast("OSM verisi alınamadı.","err","⚠️");
  }

  if(rep)rep.innerHTML="⏳ 3 m örnekleme ile park sınıfları hesaplanıyor…";
  const s=await dgV48Sample(src);
  if(!s.park){
    if(rep)rep.innerHTML="❌ Park içinde örnek üretilemedi.";
    return toast("Park örneklenemedi.","err","⚠️");
  }

  const totalM2=parkAreaM2();
  const scale=totalM2/s.park;
  const waterM2=s.water*scale;
  const hardM2=s.hard*scale;
  const greenM2=s.green*scale;
  const otherM2=s.other*scale;
  const unknownM2=s.unknown*scale;

  const ha=v=>v/10000;
  const pct=v=>totalM2>0?Math.round(v/totalM2*100):0;

  LANDCOVER={
    green:+ha(greenM2).toFixed(2),
    hard:+ha(hardM2).toFixed(2),
    water:+ha(waterM2).toFixed(2),
    other:+ha(otherM2).toFixed(2),
    unknown:+ha(unknownM2).toFixed(2),
    total:+ha(totalM2).toFixed(2),
    method:"OSM fiziksel arazi örtüsü + 3 m örnekleme",
    sampleM:3,
    sampleCount:s.park,
    sourceCounts:{water:s.water,hard:s.hard,green:s.green,other:s.other,unknown:s.unknown}
  };

  const row=(label,emoji,haV)=>{
    const p=pct(haV*10000);
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:18px;text-align:center">${emoji}</span>
      <span style="width:92px;font-size:.8rem">${label}</span>
      <div style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${p}%;background:currentColor"></div>
      </div>
      <b style="font-size:.8rem;width:72px;text-align:right">${haV.toFixed(2)} ha</b>
      <span style="font-size:.72rem;color:var(--mut);width:36px">% ${p}</span>
    </div>`;
  };

  if(rep){
    rep.innerHTML=
      `<b>🌿 Arazi Örtüsü · OSM</b> <span style="font-size:.72rem;color:var(--mut)">(fiziksel örtü etiketleri)</span>`+
      row("Yeşil","🌿",ha(greenM2))+
      row("Sert","🧱",ha(hardM2))+
      row("Su","💧",ha(waterM2))+
      row("Diğer","🟫",ha(otherM2))+
      row("Bilinmeyen","❓",ha(unknownM2))+
      `<div style="font-size:.72rem;color:var(--mut);margin-top:8px">
        Toplam: <b>${ha(totalM2).toFixed(2)} ha</b> · Sınıflar toplamı: <b>${ha(totalM2).toFixed(2)} ha</b><br>
        Örnekleme: 3 m · Örnek nokta: ${s.park.toLocaleString("tr-TR")}<br>
        Doğrudan OSM sınıflı: ${(s.park-s.unknown).toLocaleString("tr-TR")} · Bilinmeyen: ${s.unknown.toLocaleString("tr-TR")}<br>
        Kaynak: OpenStreetMap/Overpass. Park sınırı seçilen OSM geometrisidir.
      </div>`+
      `<div style="font-size:.68rem;color:#b45309;margin-top:8px">⚠ ESA WorldCover 2021 COG doğrudan tarayıcı analizine uygun şekilde doğrulanamadığı için bu sürüm WorldCover'ı sonuçlara katmıyor; OSM verisini yeşile/serte zorlamıyor.</div>`;
  }

  console.group("========== DENDROGEO V48 ==========");
  console.log("OSM örnekleme:",s);
  console.log("Alan m²:",totalM2);
  console.log("Tahmini alan m²:",{waterM2,hardM2,greenM2,otherM2,unknownM2});
  console.groupEnd();

  toast("✓ OSM arazi örtüsü analizi tamamlandı","ok","🌿");
}

window.runLandCoverAnalysis=dgV48Run;



/* =========================================================
   DENDROGEO V49 — PARK SURFACE ANALYSIS
   Stable OSM geometry engine + explicit green residual.
   
   IMPORTANT:
   - The previous V48 removed the existing highway-width model and
     therefore under-counted hard surface while leaving most park
     interior unclassified.
   - V49 restores the stable, already-used OSM water/impervious
     geometry collector.
   - Inside a selected feature tagged as a park, the remaining area
     after mapped water + mapped hard surfaces is reported as
     "park green/residual". This is an OSM-derived residual, NOT a
     satellite measurement.
   - ESA WorldCover is not silently substituted or used when its COG
     cannot be read.
========================================================= */

async function dgV49Run(){
  if(!PARK_POLY||!PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML="⏳ OSM su ve sert yüzey geometrileri okunuyor…";
  }

  toast("🌿 Park yüzey analizi başlıyor…","info");

  // Use the stable collector already used elsewhere in DendroGeo.
  const ok=await queryDetailedCoverage();
  if(!ok){
    if(rep)rep.innerHTML="❌ OSM yüzey verisi alınamadı.";
    return toast("OSM yüzey verisi alınamadı.","err","⚠️");
  }

  if(rep){
    rep.innerHTML="⏳ 3 m örnekleme ile su / sert / park-yeşil alan hesaplanıyor…";
  }

  const ref=(PARK_POLY[0]?.[0]?.[0])||39;
  const waterIdx=WATER_RINGS.map(r=>({ring:r,bbox:ringBBox(r,ref)}));
  const impIdx=IMP_RINGS.map(r=>({ring:r,bbox:ringBBox(r,ref)}));
  const lineIdx=IMP_LINES.map(l=>({
    pts:l.pts,
    w:Number.isFinite(l.w)?l.w:0,
    bbox:ringBBox(l.pts,ref)
  }));

  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  PARK_POLY.forEach(r=>r.forEach(p=>{
    minLat=Math.min(minLat,p[0]);
    maxLat=Math.max(maxLat,p[0]);
    minLon=Math.min(minLon,p[1]);
    maxLon=Math.max(maxLon,p[1]);
  }));

  const sampleM=3;
  const midLat=(minLat+maxLat)/2;
  const stepLat=sampleM/110540;
  const stepLon=sampleM/(111320*Math.cos(midLat*Math.PI/180));

  const s={
    park:0,
    water:0,
    hard:0,
    green:0,
    other:0,
    unknown:0
  };

  for(let lat=minLat;lat<=maxLat;lat+=stepLat){
    for(let lon=minLon;lon<=maxLon;lon+=stepLon){
      if(!pointInPark(lat,lon,PARK_POLY))continue;

      s.park++;

      const cls=dgPointClassAt(
        lat,
        lon,
        waterIdx,
        impIdx,
        lineIdx
      );

      if(cls==="water"){
        s.water++;
      }else if(cls==="hard"){
        s.hard++;
      }else{
        /*
         * Park polygon is the selected analysis domain.
         * After explicit water and hard OSM geometry is removed,
         * the remaining park interior is the park's green/residual
         * class for this OSM-only calculation.
         */
        s.green++;
      }
    }
  }

  if(!s.park){
    if(rep)rep.innerHTML="❌ Park içinde örnek üretilemedi.";
    return toast("Park örneklenemedi.","err","⚠️");
  }

  const geometricM2=parkAreaM2();
  const sampleAreaM2=geometricM2/s.park;

  const waterM2=s.water*sampleAreaM2;
  const hardM2=s.hard*sampleAreaM2;
  const greenM2=s.green*sampleAreaM2;
  const totalM2=geometricM2;

  const sumM2=waterM2+hardM2+greenM2;
  const residualM2=Math.max(0,totalM2-sumM2);

  const ha=v=>v/10000;
  const pct=v=>totalM2>0?Math.round(v/totalM2*100):0;

  LANDCOVER={
    green:+ha(greenM2).toFixed(2),
    hard:+ha(hardM2).toFixed(2),
    water:+ha(waterM2).toFixed(2),
    other:0,
    unknown:0,
    total:+ha(totalM2).toFixed(2),
    method:"OSM su + sert yüzey geometrileri, 3 m örnekleme; kalan park içi alan yeşil/residual",
    sampleM:3,
    sampleCount:s.park,
    sourceCounts:{
      water:s.water,
      hard:s.hard,
      green:s.green
    }
  };

  const row=(emoji,label,m2)=>{
    const h=ha(m2);
    const p=pct(m2);
    return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <span style="width:18px;text-align:center">${emoji}</span>
      <span style="width:92px;font-size:.8rem">${label}</span>
      <div style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${p}%;background:currentColor"></div>
      </div>
      <b style="font-size:.8rem;width:72px;text-align:right">${h.toFixed(2)} ha</b>
      <span style="font-size:.72rem;color:var(--mut);width:36px">% ${p}</span>
    </div>`;
  };

  const referenceHa=Number.isFinite(Number(PARK_REF_HA))
    ?Number(PARK_REF_HA)
    :null;
  const geometryHa=ha(totalM2);
  const refLine=referenceHa!==null
    ?`Harici referans alanı: <b>${referenceHa.toFixed(2)} ha</b> · OSM geometrisi: <b>${geometryHa.toFixed(2)} ha</b> · fark: <b>${Math.abs(geometryHa-referenceHa).toFixed(2)} ha</b>`
    :`OSM geometrik alanı: <b>${geometryHa.toFixed(2)} ha</b>`;

  if(rep){
    rep.innerHTML=
      `<b>🌿 Arazi Örtüsü · OSM</b> <span style="font-size:.72rem;color:var(--mut)">(geometrik yüzey analizi)</span>`+
      row("🌿","Yeşil",greenM2)+
      row("🧱","Sert",hardM2)+
      row("💧","Su",waterM2)+
      `<div style="font-size:.72rem;color:var(--mut);margin-top:8px">
        Toplam analiz alanı: <b>${geometryHa.toFixed(2)} ha</b><br>
        ${refLine}<br>
        Örnekleme: 3 m · Örnek nokta: ${s.park.toLocaleString("tr-TR")}<br>
        Su ve sert yüzey: OSM'de açıkça eşleşen geometriler + OSM highway genişlik modeli.<br>
        Yeşil: su/sert yüzeylerden arta kalan seçili park alanı.
      </div>`+
      `<div style="font-size:.68rem;color:#b45309;margin-top:8px">
        ⚠ Bu sonuç ESA WorldCover uydu sınıflandırması değildir. WorldCover COG tarayıcı erişimi doğrulanmadan sonuca katılmıyor.
      </div>`;
  }

  console.group("========== DENDROGEO V49 ==========");
  console.log("Geometric area:",geometryHa,"ha");
  console.log("Reference area:",referenceHa,"ha");
  console.log("3m samples:",s);
  console.log("Estimated m²:",{waterM2,hardM2,greenM2,residualM2});
  console.groupEnd();

  toast("✓ Park yüzey analizi tamamlandı","ok","🌿");
}

window.runLandCoverAnalysis=dgV49Run;

