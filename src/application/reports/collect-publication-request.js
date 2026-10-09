"use strict";

/* Coordinates the user-confirmed publication request without owning UI or I/O. */
function createReportPublicationRequestCollector({
 getRequestKey,
 getProjectName,
 collectContext,
 insertRequest,
 onSubmitted
}){
 const pending=new Set();
 return async function collect(parkId,lulc){
  const key=getRequestKey(parkId);
  if(!key||pending.has(key))return null;
  pending.add(key);
  try{
   const context=await collectContext(parkId,getProjectName());
   if(!context)return null;
   const result=await insertRequest(parkId,lulc,JSON.stringify(context));
   if(result?.ok)onSubmitted(key);
   return result;
  }finally{
   pending.delete(key);
  }
 };
}

window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION=Object.freeze({
 createReportPublicationRequestCollector
});
