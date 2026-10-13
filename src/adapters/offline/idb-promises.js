"use strict";
/* Promise adapters for IndexedDB request and transaction completion events. */
(function(root){
  function request(request){
    return new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  function transaction(tx){
    return new Promise((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("Yerel kuyruk işlemi başarısız."));
      tx.onabort=()=>reject(tx.error||new Error("Yerel kuyruk işlemi iptal edildi."));
    });
  }
  root.DG_OFFLINE_IDB_PROMISES=Object.freeze({request,transaction});
})(window);
