"use strict";

/* Read unvisited waypoints for the existing project-scoped point suggestion. */
window.DG_FETCH_UNVISITED_MEASUREMENT_WAYPOINTS={
  async fetch({client,projectId}){
    const{data,error}=await window.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId});
    if(error)throw error;
    return(data||[]).filter(row=>!row.visited);
  }
};
