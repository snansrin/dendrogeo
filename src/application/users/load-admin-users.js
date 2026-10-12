"use strict";
window.DG_LOAD_ADMIN_USERS={
 async execute(profile,{load,onFailure,apply,summarize,updateCounts,render,filter}){
  if(!profile||(profile.role!=="admin"&&profile.role!=="owner"))return;
  const isOwner=profile.role==="owner";
  const {data,error}=await load();
  if(error){onFailure(error);return;}
  const users=data||[];
  apply(users);
  updateCounts(summarize(users));
  render(users,isOwner);
  filter();
 }
};
