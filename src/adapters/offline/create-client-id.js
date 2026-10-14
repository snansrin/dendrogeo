"use strict";
/* Stable shape for client-side IDs used to reconcile queued measurements. */
(function(root){
  function create(){
    if(root.crypto&&root.crypto.randomUUID)return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0;
      return(c==='x'?r:(r&0x3|0x8)).toString(16);
    });
  }
  root.DG_OFFLINE_CLIENT_ID=Object.freeze({create});
})(window);
