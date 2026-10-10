"use strict";
/* Repair an existing project↔park relation; authorization remains explicit. */
(function(root){
  function create({isAdmin,getPark,getProject,getLabel,labelFromLegacy,updateProject,backfillMeasurements}){
    return async function linkProject(pid){
      if(!isAdmin())return{status:"forbidden"};
      const park=getPark();
      if(!park)return{status:"park-missing"};
      const project=getProject(pid);
      if(!project)return{status:"project-missing"};

      const input=getLabel();
      let label=input===null||input===undefined
        ?labelFromLegacy(project.name,park.name)
        :String(input).trim();
      if(!label&&project.park_id!==park.id){
        const legacy=labelFromLegacy(project.name,park.name);
        if(legacy&&legacy!==park.name)label=legacy;
      }

      const{data,error}=await updateProject(pid,{park_id:park.id,label});
      if(error)return{status:"write-failed",error};
      try{await backfillMeasurements(pid,park.id);}catch(_){/* project link is authoritative */}
      return{status:"linked",data,park};
    };
  }
  root.DG_PARK_LINK_PROJECT_APPLICATION=Object.freeze({create});
})(window);
