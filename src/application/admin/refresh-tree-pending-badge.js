"use strict";
(function(root){
 async function execute(client,update){
  try{
   const{count,error}=await client.from("measurements").select("*",{count:"exact",head:true}).eq("status","Beklemede");
   if(!error)update(count||0);
  }catch(error){}
 }
 root.DG_REFRESH_ADMIN_TREE_PENDING_BADGE=Object.freeze({execute});
})(window);
