"use strict";
window.DG_LOAD_DATA_REQUEST_QUEUE={
 async execute({load,partition,updateCounts,renderPending,renderClosed}){
  const {data}=await load();
  const {pending,closed}=partition(data||[]);
  updateCounts(pending,closed);
  renderPending(pending);
  renderClosed(closed);
 }
};
