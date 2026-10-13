"use strict";
/* IndexedDB measurement queue persistence; network synchronization stays in the service. */
(function(root){
  function open(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('DendroGeoOffline',1);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        if(!db.objectStoreNames.contains('measurements'))db.createObjectStore('measurements',{keyPath:'id',autoIncrement:true});
      };
      req.onsuccess=e=>resolve(e.target.result);
      req.onerror=e=>reject(e.target.error);
    });
  }
  async function save(data){
    const db=await open();
    const tx=db.transaction('measurements','readwrite');
    const store=tx.objectStore('measurements');
    if(!data.client_id)data.client_id=root.DG_OFFLINE_CLIENT_ID.create();
    store.add({data,timestamp:Date.now()});
    return new Promise((resolve,reject)=>{
      tx.oncomplete=()=>{
        console.log('[Offline] Veri IndexedDB\'ye kaydedildi:',data.client_id);
        db.close();
        root.updateSyncBadge();
        resolve();
      };
      tx.onerror=e=>{db.close();reject(e.target.error);};
      tx.onabort=e=>{db.close();reject(e.target.error||new Error("Yerel kayıt iptal edildi."));};
    });
  }
  async function remove(db,id){
    const tx=db.transaction('measurements','readwrite');
    const done=root.DG_OFFLINE_IDB_PROMISES.transaction(tx);
    tx.objectStore('measurements').delete(id);
    await done;
  }
  root.DG_OFFLINE_MEASUREMENT_QUEUE=Object.freeze({open,save,remove});
})(window);
