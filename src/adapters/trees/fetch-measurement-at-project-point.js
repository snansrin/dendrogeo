"use strict";

/* Fetch the latest record at one project point, keeping the existing scope/order. */
window.DG_FETCH_MEASUREMENT_AT_PROJECT_POINT={
  async fetch({client,projectId,pointId}){
    const{data}=await client.from("measurements").select("*").eq("project_id",projectId).eq("point_id",pointId).order("created_at",{ascending:false}).limit(1);
    return data&&data.length?data[0]:null;
  }
};
