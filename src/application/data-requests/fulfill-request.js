"use strict";

/* Run the existing fulfillment workflow through explicit injected ports. */
window.DG_FULFILL_DATA_REQUEST={
 async execute(id,{load,summarize,confirmEmpty,download,buildReply,openReply,complete,notify,refresh}){
  const dataset=await load(id);
  if(!dataset)return;
  const {request,rows}=dataset;
  const summary=summarize(rows);
  if(summary.count===0){
   if(!confirmEmpty())return;
  }else{
   download(rows,id);
  }
  const reply=buildReply(request,summary);
  openReply(request,reply);
  await complete(id);
  notify();
  refresh();
 }
};
