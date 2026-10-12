"use strict";
(function(root){
 function resolve(status){
  const value=status||"Beklemede";
  return{label:value==="Beklemede"?"Onay Bekliyor":value,cls:value==="Onaylı"?"on":(value==="Red"?"off":"admin")};
 }
 root.DG_RECORD_STATUS_META=Object.freeze({resolve});
})(window);
