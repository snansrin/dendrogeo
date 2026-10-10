"use strict";
/* Delete one park identity after an explicit warning and admin check. */
(function(root){
  function create({isAdmin,getPark,confirmDelete,deletePark,clearSession}){
    return async function deleteParkIdentity(id){
      if(!isAdmin())return{status:"forbidden"};
      const park=getPark(id);
      if(!park)return{status:"park-missing"};
      if(!confirmDelete(park))return{status:"cancelled"};

      const result=await deletePark(id);
      if(result&&result.error)return{status:"write-failed",error:result.error};
      clearSession();
      return{status:"deleted",id};
    };
  }
  root.DG_PARK_ADMIN_DELETE_APPLICATION=Object.freeze({create});
})(window);
