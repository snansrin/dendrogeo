"use strict";
/* Move one park identity's references and retire it through explicit ports. */
(function(root){
  function create({isAdmin,getParks,confirmMerge,moveProjects,moveMeasurements,resyncProjectNames,deletePark,clearSession}){
    return async function mergeParkIdentities(sourceId,destinationId){
      if(!isAdmin())return{status:"forbidden"};
      sourceId=+sourceId;destinationId=+destinationId;
      if(!sourceId||!destinationId||sourceId===destinationId)return{status:"invalid"};

      const parks=getParks()||[];
      const source=parks.find(park=>park.id===sourceId);
      const destination=parks.find(park=>park.id===destinationId);
      if(!source||!destination)return{status:"park-missing"};
      if(!confirmMerge(source,destination))return{status:"cancelled"};

      const projects=await moveProjects(sourceId,destinationId);
      if(projects&&projects.error)return{status:"projects-failed",error:projects.error};

      const measurements=await moveMeasurements(sourceId,destinationId);
      await resyncProjectNames(destinationId);

      const deleted=await deletePark(sourceId);
      if(deleted&&deleted.error)return{status:"delete-failed",error:deleted.error};
      clearSession();
      return{status:"merged",sourceId,destinationId,measurementError:measurements&&measurements.error||null};
    };
  }
  root.DG_PARK_ADMIN_MERGE_APPLICATION=Object.freeze({create});
})(window);
