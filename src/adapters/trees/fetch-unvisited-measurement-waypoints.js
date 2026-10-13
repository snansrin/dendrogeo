"use strict";

/* Read unvisited waypoints for the existing project-scoped point suggestion. */
window.DG_FETCH_UNVISITED_MEASUREMENT_WAYPOINTS={
  async fetch({client,projectId}){
    const{data}=await client.from("waypoints").select("*").eq("project_id",projectId).eq("visited",false);
    return data||[];
  }
};
