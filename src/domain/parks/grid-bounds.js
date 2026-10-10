"use strict";

/* Derive the geographic query bounds from the park's coordinate rings. */
function dgGridBounds(park) {
  const points = park.flat();
  return {
    minLat: Math.min(...points.map(point => point[0])),
    maxLat: Math.max(...points.map(point => point[0])),
    minLon: Math.min(...points.map(point => point[1])),
    maxLon: Math.max(...points.map(point => point[1]))
  };
}

window.DG_GRID_BOUNDS = Object.freeze({ resolve: dgGridBounds });
