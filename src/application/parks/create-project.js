"use strict";
/* Create one new project for the selected park; UI effects stay in the facade. */
(function(root){
  function create({getUser,getPark,getLabel,projectName,insertProject,persistGeometry}){
    return async function createProject(){
      const user=getUser();
      if(!user)return{status:"unauthenticated"};
      const park=getPark();
      if(!park)return{status:"park-missing"};

      const label=getLabel();
      const{data,error}=await insertProject({
        owner:user.id,
        park_id:park.id,
        label,
        name:projectName(park.name,label),
        city:park.city||"",
        country:park.country||""
      });
      if(error)return{status:"write-failed",error};
      if(typeof persistGeometry==="function")await persistGeometry(park);
      return{status:"created",data,park};
    };
  }
  root.DG_PARK_CREATE_PROJECT_APPLICATION=Object.freeze({create});
})(window);
