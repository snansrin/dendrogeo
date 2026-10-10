"use strict";

/* Resolve the grid cells eligible for automatic or manual waypoint creation. */
function dgSelectGridWaypointCells(cells, mode, selectedIds) {
  return mode === "manual"
    ? cells.filter(cell => selectedIds.has(cell.id))
    : cells.filter(cell => cell.n === 0);
}

window.DG_GRID_WAYPOINT_SELECTION = Object.freeze({ select: dgSelectGridWaypointCells });
