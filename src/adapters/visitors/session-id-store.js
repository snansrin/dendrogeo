"use strict";

/* Reuse or create the existing per-tab presence identifier. */
window.DG_VISITOR_SESSION_ID_STORE={
 load(storage,random=Math.random){
  let id=storage.getItem("dg_sid");
  if(!id){
   id=random().toString(36).slice(2,10);
   storage.setItem("dg_sid",id);
  }
  return id;
 }
};
