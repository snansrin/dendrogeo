"use strict";
(function(root){
 const read=state=>state&&typeof state.getState==="function"?state.getState():state;
 const update=(state,patch)=>state&&typeof state.setState==="function"?state.setState(patch):Object.assign(state,patch);
 async function execute(state,force,ports){
  if(!force&&read(state).mine)return read(state).mine;
  if(!ports.hasClient())return[];
  try{
   const{data,error}=await ports.load();
   if(error){
    if(/42P01|relation|view/i.test(error.message||""))ports.onMissingSchema();
    return[];
   }
   update(state,{mine:data||[]});
   return read(state).mine;
  }catch(error){return[];}
 }
 root.DG_LOAD_OWNED_INVITE_PARKS=Object.freeze({execute});
})(window);
