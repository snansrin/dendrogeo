"use strict";

/* Preserve project-scoped coordinate reads used by park focus and backfill. */
window.DG_PARK_PROJECT_READ_STORE={
  fetchMeasurements({client,projectId,limit}){return client.from("measurements").select("lat,lon").eq("project_id",projectId).limit(limit);},
  fetchBackfillProjects(client){return client.from("projects").select("id,name,owner,park_id,park_name,label,city,country");}
};
