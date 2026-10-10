"use strict";

/* Segment, ring, and line intersection with a projected rectangle. */
function dgParkSegmentIntersectsRect(a, b, rect) {
  const corners = window.DG_PARK_BOUNDS.rectCorners(rect);
  for (let i = 0; i < 4; i++) {
    if (window.DG_PARK_SEGMENTS.segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }

  if (a.x >= rect.minX && a.x <= rect.maxX && a.y >= rect.minY && a.y <= rect.maxY) return true;
  if (b.x >= rect.minX && b.x <= rect.maxX && b.y >= rect.minY && b.y <= rect.maxY) return true;
  return false;
}

function dgParkGeometryIntersectsRect(points, rect, refLat, bufferM = 0) {
  if (!points || points.length < 2) return false;
  const project = window.DG_PARK_POINT_IN_POLYGON.projectPoint;
  const bounds = window.DG_PARK_BOUNDS;
  const projected = points.map(point => project(point[0], point[1], refLat));
  const sourceBounds = bounds.expandBBox(bounds.ringBBox(points, refLat), bufferM);
  const testRect = bounds.expandBBox(rect, bufferM);
  if (!bounds.bboxesOverlap(sourceBounds, testRect)) return false;

  for (const point of projected) {
    if (point.x >= testRect.minX && point.x <= testRect.maxX &&
        point.y >= testRect.minY && point.y <= testRect.maxY) return true;
  }

  for (const corner of bounds.rectCorners(testRect)) {
    if (window.DG_PARK_POINT_IN_POLYGON.pointInPolygonXY(corner.x, corner.y, projected)) return true;
  }

  for (let i = 0; i < projected.length; i++) {
    if (dgParkSegmentIntersectsRect(projected[i], projected[(i + 1) % projected.length], testRect)) return true;
  }
  return false;
}

function dgParkGeometryLineIntersectsRect(points, rect, refLat, bufferM = 0) {
  if (!points || points.length < 2) return false;
  const bounds = window.DG_PARK_BOUNDS;
  const sourceBounds = bounds.expandBBox(bounds.ringBBox(points, refLat), bufferM);
  const testRect = bounds.expandBBox(rect, bufferM);
  if (!bounds.bboxesOverlap(sourceBounds, testRect)) return false;

  const project = window.DG_PARK_POINT_IN_POLYGON.projectPoint;
  const projected = points.map(point => project(point[0], point[1], refLat));
  for (let i = 0; i < projected.length - 1; i++) {
    if (dgParkSegmentIntersectsRect(projected[i], projected[i + 1], testRect)) return true;
  }
  return false;
}

window.DG_PARK_RECT_INTERSECTION = Object.freeze({
  segmentIntersectsRect: dgParkSegmentIntersectsRect,
  geometryIntersectsRect: dgParkGeometryIntersectsRect,
  geometryLineIntersectsRect: dgParkGeometryLineIntersectsRect
});
