"use strict";

/* Persist one waypoint with the established conflict key and error propagation. */
window.DG_UPSERT_PROJECT_WAYPOINT={
  async upsert({client,command}){const{error}=await client.from("waypoints").upsert(command.row,command.options);if(error)throw error;return true;}
};
