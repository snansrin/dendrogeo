"use strict";
/* Create a manual park identity at an unlinked project's measurement center. */
(function(root){
  function create({isAdmin,getPlanRow,confirmCreate,createPark,linkProject}){
    return async function createBackfillPark(projectId){
      if(!isAdmin())return{status:"forbidden"};
      const row=getPlanRow(projectId);
      if(!row||row.lat==null)return{status:"measurement-center-missing"};
      const name=String(row.project.name||"").trim()||"İsimsiz Park";
      if(!confirmCreate({name,lat:row.lat,lon:row.lon,row}))return{status:"cancelled"};
      const park=await createPark(name,row);
      if(!park)return{status:"park-create-failed"};
      if(!await linkProject(row.project,park))return{status:"project-link-failed",row,park};
      return{status:"created",row,park};
    };
  }
  root.DG_PARK_BACKFILL_MANUAL_APPLICATION=Object.freeze({create});
})(window);
