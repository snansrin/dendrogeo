"use strict";
window.DG_REJECT_DATA_REQUEST={
 async execute(id,{confirm,reject,onFailure,onSuccess,refresh}){
  if(!confirm())return;
  const {error}=await reject(id);
  if(error){onFailure(error);return;}
  onSuccess();refresh();
 }
};
