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
  return window.DG_PARK_CELL_VALIDITY.isCellValid(s0,s1,w0,w1,{
    cellInsidePark,
    greenOnly:DG_GREEN_ONLY,
    landcover:window.DG_LANDCOVER,
    ringBBox,
    geometryIntersectsRect,
    geometryLineIntersectsRect,
    waterRings:WATER_RINGS,
    waterLines:WATER_LINES,
    imperviousRings:IMP_RINGS,
    imperviousLines:IMP_LINES,
    gridBlockLines:GRID_BLOCK_LINES,
    waterClearanceM:WATER_CLEARANCE_M,
    imperviousClearanceM:IMP_CLEARANCE_M
  });
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
  return window.DG_PARK_IMPERVIOUS_GEOMETRY.isClosedLine(l);
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
  window.DG_PARK_IMPERVIOUS_GEOMETRY.collectImperviousGeometry(
    el,
    { rings: IMP_RINGS, lines: IMP_LINES, blockLines: GRID_BLOCK_LINES },
    { extractRings, roadHalfWidth }
  );
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
  window.DG_PARK_IMPERVIOUS_GEOMETRY.collectPedestrianGridBlocker(
    el,
    { blockLines: GRID_BLOCK_LINES },
    { roadHalfWidth }
  );
}
