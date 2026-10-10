"use strict";

/* Convert grid cell GeoJSON rings to Leaflet [LAT,LON] coordinates. */
function dgResolveGridCellShape(cell) {
  if (cell.geometry) {
    return cell.geometry.coordinates.map(polygon =>
      polygon.map(ring => ring.map(point => [point[1], point[0]]))
    );
  }
  return [
    [cell.s0, cell.w0],
    [cell.s0, cell.w1],
    [cell.s1, cell.w1],
    [cell.s1, cell.w0]
  ];
}

window.DG_GRID_CELL_SHAPE = Object.freeze({ resolve: dgResolveGridCellShape });
