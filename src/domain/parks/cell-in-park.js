"use strict";

/* Conservative grid-cell containment against park outer rings and holes. */
function dgParkCellInsidePark(s0, s1, w0, w1, parkPoly, parkHoles = []) {
  const containsPoint = window.DG_PARK_CONTAINMENT.pointInPark;
  const bounds = window.DG_PARK_BOUNDS;
  const project = window.DG_PARK_POINT_IN_POLYGON.projectPoint;
  const intersectsRect = window.DG_PARK_RECT_INTERSECTION;
  const centerLat = (s0 + s1) / 2;
  const centerLon = (w0 + w1) / 2;
  const corners = [[s0, w0], [s0, w1], [s1, w1], [s1, w0]];

  if (!containsPoint(centerLat, centerLon, parkPoly, parkHoles)) return false;
  for (const point of corners) {
    if (!containsPoint(point[0], point[1], parkPoly, parkHoles)) return false;
  }

  const rect = bounds.ringBBox(corners, centerLat);
  for (const ring of (parkPoly || [])) {
    if (!ring || ring.length < 2) continue;
    const projected = ring.map(point => project(point[0], point[1], centerLat));
    for (let i = 0; i < projected.length - 1; i++) {
      if (intersectsRect.segmentIntersectsRect(projected[i], projected[i + 1], rect)) return false;
    }
  }

  for (const ring of (parkHoles || [])) {
    if (!ring || ring.length < 3) continue;
    const ringBounds = bounds.ringBBox(ring, centerLat);
    if (!bounds.bboxesOverlap(ringBounds, rect)) continue;
    if (window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(centerLat, centerLon, ring)) return false;
    for (const point of corners) {
      if (window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(point[0], point[1], ring)) return false;
    }
    if (intersectsRect.geometryIntersectsRect(ring, rect, centerLat, 0)) return false;
  }

  return true;
}

window.DG_PARK_CELL_CONTAINMENT = Object.freeze({cellInsidePark: dgParkCellInsidePark});
