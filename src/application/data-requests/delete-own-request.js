"use strict";

/* Preserve own-request deletion guards and outcome ordering through injected ports. */
window.DG_DELETE_OWN_DATA_REQUEST_APPLICATION={
 async execute(user,id,{confirm,remove,onFailure,onSuccess,refresh}){
  if(!user||!Number.isFinite(+id))return;
  if(!confirm())return;
  const {data,error}=await remove(+id,user.id);
  if(error||!data?.length){onFailure(error);return;}
  onSuccess();
  refresh();
 }
};
