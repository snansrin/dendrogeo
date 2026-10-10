"use strict";
/* Decide whether a new measurement may proceed with the selected project. */
(function(root){
  function create({schemaReady,editing,hasGate,getProject,isAdmin,redirectAlreadyUsed}){
    return function evaluate(auto){
      if(!schemaReady())return{status:"schema-unavailable",allowed:true};
      const project=getProject();
      if(!hasGate())return{status:"gate-unavailable",allowed:!!(project&&project.park_id),project};
      if(editing())return{status:"editing",allowed:true,project};
      if(!project){
        return{status:"project-required",allowed:false,project:null,redirect:auto===true&&!redirectAlreadyUsed(0)?{returnTo:"measure"}:null};
      }
      if(!project.park_id){
        return{status:"park-required",allowed:false,project,isAdmin:!!isAdmin(),redirect:auto===true&&!redirectAlreadyUsed(project.id)?{projectId:project.id,returnTo:"measure"}:null};
      }
      return{status:"ready",allowed:true,project,parkName:project.parks&&project.parks.name?project.parks.name:(project.park_name||"Park"),areaM2:project.parks&&project.parks.area_m2||null};
    };
  }
  root.DG_PARK_MEASUREMENT_GATE_APPLICATION=Object.freeze({create});
})(window);
