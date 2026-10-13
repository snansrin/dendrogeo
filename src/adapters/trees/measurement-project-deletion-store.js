"use strict";

/* Preserve project-scoped count and delete ordering under the existing RLS. */
window.DG_MEASUREMENT_PROJECT_DELETION_STORE={
  async countMeasurements({client,projectId}){
    const{count}=await client.from("measurements").select("*",{count:"exact",head:true}).eq("project_id",projectId);
    return count||0;
  },
  async delete({client,projectId}){
    await client.from("waypoints").delete().eq("project_id",projectId);
    await client.from("projects").delete().eq("id",projectId);
  }
};
