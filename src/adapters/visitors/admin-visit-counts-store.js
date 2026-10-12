"use strict";

/* Individual admin count reads; the caller owns ordering and partial UI updates. */
window.DG_VISITOR_ADMIN_VISIT_COUNTS_STORE={
 create(){
  function total(client){
   return client.from("site_visits").select("*",{count:"exact",head:true});
  }
  function since(client,date){
   return client.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",date);
  }
  return Object.freeze({total,since});
 }
};
