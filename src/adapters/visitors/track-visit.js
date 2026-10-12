"use strict";

/* Insert one public site visit with the RLS-safe minimal return preference. */
window.DG_VISITOR_TRACK_VISIT_ADAPTER={
 create(){
  function record(fetcher,url,key){
   return fetcher(url+"/rest/v1/site_visits",{
    method:"POST",
    headers:{
     "apikey":key,
     "Authorization":"Bearer "+key,
     "Content-Type":"application/json",
     "Prefer":"return=minimal"
    },
    body:JSON.stringify([{}])
   });
  }
  return Object.freeze({record});
 }
};
