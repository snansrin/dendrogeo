"use strict";
(function(root){
 function summarize(data){
  return{
   users:(data.users||[]).length,
   records:data.measurementCount??(data.measurements||[]).length,
   projects:(data.projects||[]).length,
   carbon:(data.global&&data.global.carbon_t)||0
  };
 }
 root.DG_ADMIN_OVERVIEW_SUMMARY=Object.freeze({summarize});
})(window);
