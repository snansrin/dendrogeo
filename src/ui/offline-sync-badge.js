"use strict";
/* Show the number of drafts waiting in the local measurement queue. */
(function(root){
  async function update(){
    const badge=document.getElementById("syncBadge");
    if(!badge)return;
    try{
      const db=await root.DG_OFFLINE_MEASUREMENT_QUEUE.open();
      const count=await root.DG_OFFLINE_IDB_PROMISES.request(db.transaction("measurements","readonly").objectStore("measurements").count());
      db.close();
      if(count>0){
        badge.textContent="⏳ "+count;
        badge.title=typeof dgTfs==="function"?dgTfs("{n} ölçüm senkron bekliyor",{n:count}):count+" ölçüm senkron bekliyor";
        badge.style.display="";
      }else badge.style.display="none";
    }catch(error){/* badge kozmetik; sessiz kal */}
  }
  root.DG_OFFLINE_SYNC_BADGE=Object.freeze({update});
  root.updateSyncBadge=update;
})(window);
