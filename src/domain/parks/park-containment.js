"use strict";

/* Park containment across outer rings and holes; coordinates stay [LAT,LON]. */
function dgParkContainsPoint(lat, lon, rings, legacyHoles = []) {
  if (!rings) return false;

  if (Array.isArray(rings)) {
    if (!rings.length) return false;
    const insideOuter = rings.some(ring =>
      window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(lat, lon, ring)
    );
    if (!insideOuter) return false;
    const insideHole = legacyHoles.some(ring =>
      window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(lat, lon, ring)
    );
    return !insideHole;
  }

  if (rings.outer) {
    const insideOuter = rings.outer.some(ring =>
      window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(lat, lon, ring)
    );
    if (!insideOuter) return false;
    const insideHole = (rings.inner || []).some(ring =>
      window.DG_PARK_POINT_IN_POLYGON.pointInPolygon(lat, lon, ring)
    );
    return !insideHole;
  }

  return false;
}

window.DG_PARK_CONTAINMENT = Object.freeze({pointInPark: dgParkContainsPoint});
