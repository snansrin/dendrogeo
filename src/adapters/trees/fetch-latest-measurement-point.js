"use strict";

/* Read the highest project point id for the established next-id fallback. */
window.DG_FETCH_LATEST_MEASUREMENT_POINT={
  async fetch({client,projectId}){
    const{data}=await client.from("measurements").select("point_id").eq("project_id",projectId).order("point_id",{ascending:false}).limit(1);
    return data&&data.length?data[0]:null;
  }
};
