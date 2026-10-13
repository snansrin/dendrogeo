"use strict";
(function(root){
 const update=(state,patch)=>state&&typeof state.setState==="function"?state.setState(patch):state&&Object.assign(state,patch);
 async function execute(email,load,state){
  try{
   const{data,error}=await load();
   const rows=error?[]:(data||[]).filter(row=>String(row.email||"").toLowerCase()===String(email||"").toLowerCase());
   update(state,{received:rows});
   return rows;
  }catch(error){update(state,{received:[]});return[];}
 }
 root.DG_LOAD_RECIPIENT_PARK_INVITES=Object.freeze({execute});
})(window);
