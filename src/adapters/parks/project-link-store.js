"use strict";
/* Supabase adapter for the administrator's existing-project repair flow. */
(function(root){
  function create({getClient}){
    async function updateProject(pid,patch){
      return await getClient().from("projects").update(patch).eq("id",pid).select().single();
    }
    async function backfillMeasurements(projectId,parkId){
      return await getClient().from("measurements").update({park_id:parkId}).eq("project_id",projectId).is("park_id",null);
    }
    return Object.freeze({updateProject,backfillMeasurements});
  }
  root.DG_PARK_PROJECT_LINK_STORE_ADAPTER=Object.freeze({create});
})(window);
