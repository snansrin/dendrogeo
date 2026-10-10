"use strict";

/* Assign approved measurements to matching grid cells without choosing a cell by bbox alone. */
function dgCountGridCellMeasurements(cells, measurements, dependencies) {
  const byId = new Map();
  for (const cell of cells) {
    const group = byId.get(cell.baseId) || [];
    group.push(cell);
    byId.set(cell.baseId, group);
  }

  for (const measurement of measurements || []) {
    const point = dependencies.project(+measurement.lat, +measurement.lon, dependencies.epsg);
    const baseId =
      Math.floor((point.y - dependencies.y0) / dependencies.size) +
      "_" +
      Math.floor((point.x - dependencies.x0) / dependencies.size);
    const candidates = byId.get(baseId) || [];
    const cell = candidates.find(candidate =>
      dependencies.pointDistance(
        [point.x, point.y],
        dependencies.featureGeometry({ geometry: candidate.geometry }, dependencies.epsg)
      ) >= 0
    );
    if (cell) cell.n++;
  }

  return cells;
}

window.DG_GRID_CELL_MEASUREMENTS = Object.freeze({ count: dgCountGridCellMeasurements });
