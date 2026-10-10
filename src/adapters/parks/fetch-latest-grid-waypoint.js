"use strict";

/* Read the highest existing waypoint ID for a project before grid inserts. */
function dgFetchLatestGridWaypoint(client, projectId) {
  return client
    .from("waypoints")
    .select("wp_id")
    .eq("project_id", projectId)
    .order("wp_id", { ascending: false })
    .limit(1);
}

window.DG_GRID_WAYPOINT_STORE = Object.freeze({ fetchLatest: dgFetchLatestGridWaypoint });
