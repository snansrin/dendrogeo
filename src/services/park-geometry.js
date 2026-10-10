"use strict";
/* DendroGeo · services/park-geometry.js — SAF GEOMETRİ/TOPOLOJİ (Faz 4)
 * gridplan.js'ten birebir taşınan ~1500 satır saf matematik: jeodezik alan,
 * lokal projeksiyon, point-in-polygon, doğru/dikdörtgen kesişimi, hücre
 * geçerlilik testi, OSM way→ring birleştirme ve su/sert-yüzey sınıflandırma
 * yardımcıları. DOM/ağ bağımlılığı YOKTUR → doğrudan birim test edilir
 * (test/geometry.test.mjs).
 * ⚠️ KOORDİNAT SÖZLEŞMESİ (eski dosyadakiyle aynı, testlerle kilitli):
 *   ringGeodesicArea/polyArea ringleri [LON,LAT]; pointInPolygon/pointInPark
 *   ringleri [LAT,LON] bekler. */

/* =========================================================
   AREA
========================================================= */

function ringGeodesicArea(ring){
  return window.DG_PARK_AREA.ringGeodesicArea(ring);
}

function polyArea(rings){
  return window.DG_PARK_AREA.polyArea(rings);
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
  return window.DG_PARK_POINT_IN_POLYGON.projectPoint(lat,lon,refLat);
}

function ringBBox(ring,refLat){
  return window.DG_PARK_BOUNDS.ringBBox(ring,refLat);
}

function expandBBox(x,d){
  return window.DG_PARK_BOUNDS.expandBBox(x,d);
}

function bboxesOverlap(a,b){
  return window.DG_PARK_BOUNDS.bboxesOverlap(a,b);
}

function pointInPolygonXY(x,y,poly){
  return window.DG_PARK_POINT_IN_POLYGON.pointInPolygonXY(x,y,poly);
}

function pointInPolygon(lat,lon,ring){
  return window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(lat,lon,ring);
}

function pointInPark(lat,lon,rings){
  return window.DG_PARK_CONTAINMENT.pointInPark(lat,lon,rings,PARK_HOLES);
}

/* =========================================================
   SEGMENT / RECT
========================================================= */

function orientation(a,b,c){
  return window.DG_PARK_SEGMENTS.orientation(a,b,c);
}

function onSegment(a,b,p){
  return window.DG_PARK_SEGMENTS.onSegment(a,b,p);
}

function segmentsIntersect(a,b,c,d){
  return window.DG_PARK_SEGMENTS.segmentsIntersect(a,b,c,d);
}

function rectCorners(r){
  return window.DG_PARK_BOUNDS.rectCorners(r);
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

  /* YEŞİL ALAN KISITI: LULC analizi varsa ve açıksa, hücre merkezi yeşil
   * nesne içinde olmalı. Waypoint'ler grid hücrelerinden türediği için
   * otomatik olarak yeşil alandan seçilir. */
  if(
    DG_GREEN_ONLY&&
    window.DG_LANDCOVER&&
    typeof window.DG_LANDCOVER.isGreen==="function"&&
    window.DG_LANDCOVER.hasGreen&&
    window.DG_LANDCOVER.hasGreen()
  ){
    if(!window.DG_LANDCOVER.isGreen(cLat,(w0+w1)/2))return false;
  }

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
  if(!el || typeof el!=="object")return null;

  function closeRing(r){
    if(!Array.isArray(r)||r.length<3)return null;

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
    Array.isArray(el.geometry)
  ){
    const r=el.geometry
      .filter(g=>g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lon)))
      .map(g=>[Number(g.lat),Number(g.lon)]);

    const closed=closeRing(r);

    return closed
      ? [closed]
      : null;
  }

  if(
    el.type==="relation" &&
    Array.isArray(el.members)
  ){
    const validMember=m=>m && Array.isArray(m.geometry) && m.geometry.length>=2;

    const outerWays=el.members
      .filter(m=>m.role==="outer" && validMember(m))
      .map(m=>m.geometry.filter(g=>g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lon))).map(g=>[Number(g.lat),Number(g.lon)]))
      .filter(w=>w.length>=2);

    const innerWays=el.members
      .filter(m=>m.role==="inner" && validMember(m))
      .map(m=>m.geometry.filter(g=>g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lon))).map(g=>[Number(g.lat),Number(g.lon)]))
      .filter(w=>w.length>=2);

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
      outer:outer.filter(r=>Array.isArray(r)&&r.length>=4),
      inner:inner.filter(r=>Array.isArray(r)&&r.length>=4)
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

/* =========================================================
   WATER
========================================================= */

function isWater(el){
  return window.DG_PARK_SURFACE_TAGS.isWater(el);
}

/* =========================================================
   IMPERVIOUS (GÜÇLENDİRİLDİ)
   - softSurfaces eklendi
   - yumuşak yüzeyli yollar sert sayılmaz
========================================================= */

function isImpervious(el){
  return window.DG_PARK_SURFACE_TAGS.isImpervious(el);
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
  return window.DG_PARK_ROAD_WIDTH.halfWidth(hw);
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
    GRID_BLOCK_LINES.push({
      pts,
      w:Math.max(1,w)
    });
  }
}

/*
 * Yaya yolları için ayrı grid engelleyici.
 *
 * ÖNEMLİ: footway/path/pedestrian vb. OSM'de surface etiketi boşsa
 * isImpervious() bunları arazi-örtüsü "sert zemin" olarak sınıflandırmaz.
 * Bu doğru davranıştır. Ancak grid planında yolun üzerinden örnek hücresi
 * geçirilmesi de doğru değildir. Bu nedenle bu geometri yalnızca
 * GRID_BLOCK_LINES'a eklenir; IMP_RINGS/IMP_LINES'a eklenmez.
 */
function collectPedestrianGridBlocker(el){
  if(!el || !el.geometry || !el.tags || !el.tags.highway)return;

  const hw=String(el.tags.highway).toLowerCase();
  if(!/^(footway|path|cycleway|steps|pedestrian|bridleway|track)$/.test(hw))return;

  const pts=el.geometry.map(g=>[g.lat,g.lon]);
  if(pts.length<2)return;

  const width=parseFloat(
    String(el.tags.width||"").replace(",",".")
  );

  let halfWidth;
  if(Number.isFinite(width) && width>0 && width<30){
    halfWidth=width/2;
  }else{
    const lanes=parseFloat(
      String(el.tags.lanes||"").replace(",",".")
    );
    if(Number.isFinite(lanes) && lanes>0 && lanes<10){
      halfWidth=Math.max(1.25,(lanes*3.0)/2);
    }else{
      halfWidth=roadHalfWidth(hw);
    }
  }

  GRID_BLOCK_LINES.push({pts,w:Math.max(1,halfWidth)});
}
