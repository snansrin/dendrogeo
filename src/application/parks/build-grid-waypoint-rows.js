"use strict";

/* Build waypoint insert rows from eligible grid cells using safe interior points. */
function dgBuildGridWaypointRows(cells, firstWpId, ownerId, projectId) {
  let nextWpId = firstWpId;
  return cells.map(cell => ({
    owner: ownerId,
    project_id: projectId,
    wp_id: nextWpId++,
    /* New grid cells use safe interior points; legacy cells fall back to center. */
    lat: +(Number.isFinite(cell.lat) ? cell.lat : (cell.s0 + cell.s1) / 2).toFixed(6),
    lon: +(Number.isFinite(cell.lon) ? cell.lon : (cell.w0 + cell.w1) / 2).toFixed(6),
    visited: false
  }));
}

window.DG_GRID_WAYPOINT_ROWS = Object.freeze({ build: dgBuildGridWaypointRows });
