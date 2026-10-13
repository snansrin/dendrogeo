"use strict";
(function(root){
 async function execute(ports,update){
  try{
   const{count,error}=await ports.countPendingMeasurements();
   if(!error)update(count||0);
  }catch(error){}
 }
 root.DG_REFRESH_ADMIN_TREE_PENDING_BADGE=Object.freeze({execute});
})(window);
