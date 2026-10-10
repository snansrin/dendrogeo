"use strict";

/* Projected ring and rectangle bounds for park geometry. */
function dgParkRingBounds(ring, refLat) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of ring) {
    const projected = window.DG_PARK_POINT_IN_POLYGON.projectPoint(point[0], point[1], refLat);
    if (projected.x < minX) minX = projected.x;
    if (projected.y < minY) minY = projected.y;
    if (projected.x > maxX) maxX = projected.x;
    if (projected.y > maxY) maxY = projected.y;
  }

  return {minX, minY, maxX, maxY};
}

function dgParkExpandBounds(bounds, distance) {
  return {
    minX: bounds.minX - distance,
    minY: bounds.minY - distance,
    maxX: bounds.maxX + distance,
    maxY: bounds.maxY + distance
  };
}

function dgParkBoundsOverlap(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function dgParkRectCorners(rect) {
  return [
    {x: rect.minX, y: rect.minY},
    {x: rect.maxX, y: rect.minY},
    {x: rect.maxX, y: rect.maxY},
    {x: rect.minX, y: rect.maxY}
  ];
}

window.DG_PARK_BOUNDS = Object.freeze({
  ringBBox: dgParkRingBounds,
  expandBBox: dgParkExpandBounds,
  bboxesOverlap: dgParkBoundsOverlap,
  rectCorners: dgParkRectCorners
});
