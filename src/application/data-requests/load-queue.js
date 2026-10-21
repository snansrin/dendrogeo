"use strict";
window.DG_LOAD_DATA_REQUEST_QUEUE={
 async execute({load,partition,updateCounts,renderPending,renderClosed}){
  const {data,error}=await load();
  if(error)return;
  const {pending,closed}=partition(data||[]);
  updateCounts(pending,closed);
  renderPending(pending);
  renderClosed(closed);
 }
};
