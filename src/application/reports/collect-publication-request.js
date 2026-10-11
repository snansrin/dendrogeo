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

/* Pure projection of publication queue data; the service supplies time and ID validation. */
function createReportPublicationQueueState({isReportId,now=()=>Date.now()}){
 function entryFor(queue,reqId){
  if((queue?.archived_request_ids||[]).includes(String(reqId)))return {request_id:reqId,status:"Test arşivi"};
  const es=(queue&&queue.entries)||[];
  for(let i=es.length-1;i>=0;i--)if(String(es[i].request_id)===String(reqId))return es[i];
  return null;
 }
 function retractedIds(queue){
  const out={};
  for(const e of ((queue&&queue.entries)||[]))
   if(e.status==="Geri çekildi"&&isReportId(e.report_id))out[String(e.report_id)]=e;
  return out;
 }
 function retractionDone(queue,retId){
  if((queue?.archived_retraction_ids||[]).includes(String(retId)))return {retraction_id:retId,status:"Test arşivi"};
  for(const e of ((queue&&queue.entries)||[]))
   if(e.status==="Geri çekildi"&&String(e.retraction_id)===String(retId))return e;
  return null;
 }
 function retractedInPark(queue,parkId){
  const es=(queue&&queue.entries)||[];
  for(let i=es.length-1;i>=0;i--){
   const e=es[i];
   if(e.status==="Geri çekildi"&&String(e.park_id)===String(parkId))return e;
  }
  return null;
 }
 function publishedByPark(queue){
  const ret=retractedIds(queue);
  const out={};
  for(const e of ((queue&&queue.entries)||[]))
   if(e.status==="Yayınlandı"&&isReportId(e.report_id)&&!ret[String(e.report_id)])out[String(e.park_id)]=e;
  return out;
 }
 function status(req,queue){
  const e=entryFor(queue,req.id);
  if(e?.status==="Test arşivi")return {key:"cancelled",label:"Test arşivi",reportId:"",note:"Test yayını üretim geçmişinden çıkarıldı.",entry:e};
  if(e&&e.status==="Yayınlandı")return{key:"published",label:"Yayınlandı",reportId:isReportId(e.report_id)?e.report_id:"",note:"yayın "+String(e.finished_at||"").slice(0,10),entry:e};
  if(e&&e.status==="Başarısız")return{key:"failed",label:"Başarısız",reportId:"",note:String(e.message||"üretim hatası"),entry:e};
  if(req.status==="Vazgeçildi")return{key:"cancelled",label:"Vazgeçildi",reportId:"",note:"iptal "+String(req.cancelled_at||"").slice(0,10),entry:null};
  const dk=Math.max(0,Math.round((now()-new Date(req.created_at||now()).getTime())/60000));
  return{key:"pending",label:"Beklemede",reportId:"",note:(dk<1?"az önce kuyruğa alındı":dk+" dk önce kuyruğa alındı"),entry:null};
 }
 return Object.freeze({entryFor,retractedIds,retractionDone,retractedInPark,publishedByPark,status});
}

window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION=Object.freeze({
 createReportPublicationRequestCollector,
 createReportPublicationQueueState
});

