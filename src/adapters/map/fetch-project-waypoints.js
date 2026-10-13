"use strict";

window.DG_FETCH_PROJECT_WAYPOINTS={
  async fetch({client,projectId}){return await client.from("waypoints").select("*").eq("project_id",projectId).order("wp_id",{ascending:true});}
};
