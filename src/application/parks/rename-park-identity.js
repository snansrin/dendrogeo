"use strict";
/* Rename a park identity and rebuild project names through explicit ports. */
(function(root){
  function create({isAdmin,getParks,promptName,normalizeName,updatePark,resyncProjectNames}){
    return async function renameParkIdentity(id){
      if(!isAdmin())return{status:"forbidden"};
      const park=(getParks()||[]).find(row=>row.id===id);
      if(!park)return{status:"park-missing"};

      const input=promptName(park);
      if(input===null||input===undefined)return{status:"cancelled"};
      const name=String(input).trim();
      if(!name)return{status:"empty-name"};

      const result=await updatePark(id,{name,name_norm:normalizeName(name)});
      if(result&&result.error)return{status:"write-failed",error:result.error};
      await resyncProjectNames(id,name);
      return{status:"renamed",id,name};
    };
  }
  root.DG_PARK_ADMIN_RENAME_APPLICATION=Object.freeze({create});
})(window);
