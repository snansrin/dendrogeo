"use strict";
/* Apply the reviewed park-link plan in order, preserving partial failures. */
(function(root){
  function create({isAdmin,confirmApply,onProgress,registerPark,linkProject}){
    return async function applyParkBackfill(rows){
      if(!isAdmin())return{status:"forbidden"};
      const plan=(rows||[]).filter(row=>row.durum==="eşleşti");
      if(!plan.length)return{status:"empty-plan"};
      if(!confirmApply(plan.length))return{status:"cancelled"};
      let successes=0,failures=0;
      for(let i=0;i<plan.length;i++){
        const row=plan[i];
        onProgress(i,plan.length,row.project.name+" → bağlanıyor");
        const candidate=Object.assign({},row.cand,{name:row.parkName||(row.cand&&row.cand.name)});
        const park=await registerPark(candidate,{lat:row.lat,lon:row.lon,source:"backfill"});
        if(!park){failures++;continue;}
        if(await linkProject(row.project,park))successes++;else failures++;
      }
      return{status:"applied",successes,failures};
    };
  }
  root.DG_PARK_BACKFILL_APPLY_APPLICATION=Object.freeze({create});
})(window);
