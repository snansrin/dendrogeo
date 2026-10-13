"use strict";
(function(root){
 async function execute(allowed,ports){
  if(!allowed())return;
  try{
   const counts=await ports.load();
   ports.update("vzTotal",counts.total);ports.update("vzToday",counts.today);ports.update("vz7",counts.sevenDays);
  }catch(error){}
 }
 root.DG_LOAD_OWNER_VISITOR_COUNTS=Object.freeze({execute});
})(window);
