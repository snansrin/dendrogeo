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
  return window.DG_PARK_RECT_INTERSECTION.segmentIntersectsRect(a,b,rect);
}

function geometryIntersectsRect(
  points,
  rect,
  refLat,
  bufferM=0
){
  return window.DG_PARK_RECT_INTERSECTION.geometryIntersectsRect(points,rect,refLat,bufferM);
}

function geometryLineIntersectsRect(
  points,
  rect,
  refLat,
  bufferM=0
){
  return window.DG_PARK_RECT_INTERSECTION.geometryLineIntersectsRect(points,rect,refLat,bufferM);
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
  return window.DG_PARK_CELL_CONTAINMENT.cellInsidePark(s0,s1,w0,w1,PARK_POLY,PARK_HOLES);
}

function pointToSegmentDistanceM(lat,lon,a,b){
  return window.DG_PARK_LINE_DISTANCE.pointToSegmentDistanceM(lat,lon,a,b);
}

function pointNearImperviousLine(lat,lon,lines){
  return window.DG_PARK_LINE_DISTANCE.pointNearImperviousLine(lat,lon,lines);
}

/* =========================================================
   OSM 10 m CROSS-CHECK
========================================================= */

function pointNearAnyLine(lat,lon,lines,maxDistanceM){
  return window.DG_PARK_LINE_DISTANCE.pointNearAnyLine(lat,lon,lines,maxDistanceM);
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
  return window.DG_PARK_OVERLAP.segmentsIntersectLatLon(a1,a2,b1,b2);
}

/* =========================================================
   PARK INTERSECTION
========================================================= */

function ringTouchesPark(
  ring,
  parkRings,
  pb
){
  return window.DG_PARK_OVERLAP.ringTouchesPark(ring,parkRings,pb,PARK_HOLES);
}

function lineTouchesPark(
  line,
  parkRings,
  pb
){
  return window.DG_PARK_OVERLAP.lineTouchesPark(line,parkRings,pb,PARK_HOLES);
}

/* =========================================================
   OSM GEOMETRY
========================================================= */

function extractRings(el){
  return window.DG_PARK_OSM_RINGS.extractRings(el);
}

function joinWaysToRings(ways){
  return window.DG_PARK_OSM_RINGS.joinWaysToRings(ways);
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
