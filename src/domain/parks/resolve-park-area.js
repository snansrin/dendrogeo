"use strict";

/* Keep the selected park area authoritative, with geometry as a fallback. */
function dgResolveParkAreaM2(selectedAreaM2, parkPolygon, parkHoles, calculatePolygonArea) {
  if (Number.isFinite(selectedAreaM2) && selectedAreaM2 > 0) return selectedAreaM2;
  if (!parkPolygon) return 0;
  return calculatePolygonArea({ outer: parkPolygon, inner: parkHoles });
}

function dgParkAreaHectares(areaM2) {
  return areaM2 / 10000;
}

window.DG_PARK_AREA_RESOLUTION = Object.freeze({
  resolveAreaM2: dgResolveParkAreaM2,
  hectaresFromSquareMeters: dgParkAreaHectares
});
