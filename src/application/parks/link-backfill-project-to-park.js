"use strict";

/* Link one existing project, then best-effort backfill denormalized measurements. */
window.DG_LINK_BACKFILL_PROJECT_TO_PARK={
  create({buildPatch,updateProject,backfillMeasurements}){
    return async function link(project,park){
      const{error}=await updateProject(project.id,buildPatch(project,park));
      if(error)return{status:"write-failed",project,error};
      try{await backfillMeasurements(project.id,park.id);}catch(_){/* The project link is authoritative. */}
      return{status:"linked",project,park};
    };
  }
};
