"use strict";
(function(root){
 async function execute(email,load){
  try{
   const{data,error}=await load();
   return error?[]:(data||[]).filter(row=>String(row.email||"").toLowerCase()===String(email||"").toLowerCase());
  }catch(error){return[];}
 }
 root.DG_LOAD_RECIPIENT_PARK_INVITES=Object.freeze({execute});
})(window);
