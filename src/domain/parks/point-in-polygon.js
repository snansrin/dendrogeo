"use strict";

/* Local park plane and point-in-ring rules. Rings use the legacy [LAT,LON] order. */
function dgParkProjectPoint(lat, lon, refLat) {
  return {
    x: lon * 111320 * Math.cos(refLat * Math.PI / 180),
    y: lat * 110540
  };
}

function dgParkPointInPolygonXY(x, y, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

function dgParkPointInPolygon(lat, lon, ring) {
  if (!ring || ring.length < 3) return false;

  const point = dgParkProjectPoint(lat, lon, lat);
  const polygon = ring.map(coordinate =>
    dgParkProjectPoint(coordinate[0], coordinate[1], lat)
  );

  return dgParkPointInPolygonXY(point.x, point.y, polygon);
}

window.DG_PARK_POINT_IN_POLYGON = Object.freeze({
  projectPoint: dgParkProjectPoint,
  pointInPolygonXY: dgParkPointInPolygonXY,
  pointInPolygon: dgParkPointInPolygon
});
