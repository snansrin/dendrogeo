"use strict";

/* Continue project waypoint IDs and build rows for the selected grid cells. */
function dgPrepareGridWaypointBatch(cells, latestRows, ownerId, projectId, buildRows) {
  const firstWpId = (latestRows && latestRows.length ? latestRows[0].wp_id : 0) + 1;
  return {
    firstWpId,
    rows: buildRows(cells, firstWpId, ownerId, projectId)
  };
}

window.DG_GRID_WAYPOINT_BATCH = Object.freeze({ prepare: dgPrepareGridWaypointBatch });
