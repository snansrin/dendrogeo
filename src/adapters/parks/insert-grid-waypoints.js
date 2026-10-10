"use strict";

/* Keep grid waypoint persistence behind a small Supabase adapter. */
function dgInsertGridWaypoints(client, rows) {
  return client
    .from("waypoints")
    .insert(rows);
}

window.DG_GRID_WAYPOINT_INSERT = Object.freeze({ insert: dgInsertGridWaypoints });
