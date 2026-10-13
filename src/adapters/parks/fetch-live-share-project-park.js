"use strict";

/* Keep the existing project-scoped park_id read and PostgREST result shape. */
window.DG_FETCH_LIVE_SHARE_PROJECT_PARK={
  async fetch({client,projectId}){
    const{data}=await client.from("projects").select("park_id").eq("id",projectId).maybeSingle();
    return(data&&data.park_id)||0;
  }
};
