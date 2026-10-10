"use strict";
/* Build the admin review plan for projects without a park identity. */
(function(root){
  function create({isAdmin,isOnline,fetchProjects,fetchMeasurements,detectPark,sleep,suggestParkName,projectName,labelFromLegacy,onProgress}){
    return async function planParkBackfill(){
      if(!isAdmin())return{status:"forbidden"};
      if(!isOnline())return{status:"offline"};
      const{data:projects,error}=await fetchProjects();
      if(error)return{status:"projects-load-failed",error};
      const targets=(projects||[]).filter(project=>!project.park_id);
      if(!targets.length)return{status:"no-targets"};

      const plan=[];
      for(let i=0;i<targets.length;i++){
        const project=targets[i];
        onProgress(i,targets.length,project.name);
        const{data:measurements}=await fetchMeasurements(project.id);
        const points=(measurements||[]).filter(row=>Number.isFinite(+row.lat)&&Number.isFinite(+row.lon));
        if(!points.length){
          plan.push({project,durum:"ölçüm yok",park:null,cand:null,lat:null,lon:null});
          continue;
        }
        const lat=points.reduce((sum,row)=>sum+(+row.lat),0)/points.length;
        const lon=points.reduce((sum,row)=>sum+(+row.lon),0)/points.length;
        const found=await detectPark(lat,lon,project.name);
        await sleep(2100);
        if(!found.cands||!found.cands.length){
          plan.push({project,durum:"OSM'de park yok",park:null,cand:null,lat,lon,n:points.length});
          continue;
        }
        const cand=found.cands[0];
        const parkName=cand.name||suggestParkName(project.name);
        plan.push({
          project,durum:"eşleşti",yol:found.yol,cand,lat,lon,n:points.length,
          parkName,adsiz:!cand.name,
          newName:projectName(parkName,labelFromLegacy(project.name,parkName))
        });
      }
      return{status:"planned",plan};
    };
  }
  root.DG_PARK_BACKFILL_PLAN_APPLICATION=Object.freeze({create});
})(window);
