"use strict";
(function(root){
 async function execute(state,force,ports){
  if(!force&&state.mine)return state.mine;
  if(!ports.hasClient())return[];
  try{
   const{data,error}=await ports.load();
   if(error){
    if(/42P01|relation|view/i.test(error.message||""))ports.onMissingSchema();
    return[];
   }
   state.mine=data||[];
   return state.mine;
  }catch(error){return[];}
 }
 root.DG_LOAD_OWNED_INVITE_PARKS=Object.freeze({execute});
})(window);
