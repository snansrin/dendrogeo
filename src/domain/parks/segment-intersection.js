"use strict";

/* Planar segment predicates used by park-grid and coverage geometry. */
function dgParkOrientation(a, b, c) {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function dgParkPointOnSegment(a, b, point) {
  return point.x >= Math.min(a.x, b.x) - 1e-9 &&
    point.x <= Math.max(a.x, b.x) + 1e-9 &&
    point.y >= Math.min(a.y, b.y) - 1e-9 &&
    point.y <= Math.max(a.y, b.y) + 1e-9;
}

function dgParkSegmentsIntersect(a, b, c, d) {
  const o1 = dgParkOrientation(a, b, c);
  const o2 = dgParkOrientation(a, b, d);
  const o3 = dgParkOrientation(c, d, a);
  const o4 = dgParkOrientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && dgParkPointOnSegment(a, b, c)) return true;
  if (o2 === 0 && dgParkPointOnSegment(a, b, d)) return true;
  if (o3 === 0 && dgParkPointOnSegment(c, d, a)) return true;
  if (o4 === 0 && dgParkPointOnSegment(c, d, b)) return true;
  return false;
}

window.DG_PARK_SEGMENTS = Object.freeze({
  orientation: dgParkOrientation,
  onSegment: dgParkPointOnSegment,
  segmentsIntersect: dgParkSegmentsIntersect
});
