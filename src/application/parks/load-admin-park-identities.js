"use strict";
/* Load park identity rows and their project/measurement context for admin UI. */
(function(root){
  function create({isAdmin,fetchParks,fetchProjects,fetchMeasurements}){
    return async function loadAdminParkIdentities(){
      if(!isAdmin())return{status:"forbidden"};
      const[parks,projects,measurements]=await Promise.all([
        fetchParks(),fetchProjects(),fetchMeasurements()
      ]);
      if(parks&&parks.error)return{status:"park-load-failed",error:parks.error};
      return{
        status:"loaded",
        parks:(parks&&parks.data)||[],
        projects:(projects&&projects.data)||[],
        measurements:(measurements&&measurements.data)||[]
      };
    };
  }
  root.DG_PARK_ADMIN_LOAD_APPLICATION=Object.freeze({create});
})(window);
