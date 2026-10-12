"use strict";
window.DG_LOAD_OWN_DATA_REQUESTS={
 async execute(user,{load,getTarget,onFailure,onEmpty,render}){
  if(!user)return;
  const {data,error}=await load(user.id);
  const target=getTarget();if(!target)return;
  if(error){onFailure(target);return;}
  if(!data||!data.length){onEmpty(target);return;}
  render(target,data);
 }
};
