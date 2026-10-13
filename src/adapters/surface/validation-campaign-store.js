"use strict";

/* Persist validation campaigns in their isolated IndexedDB database. */
window.DG_VALIDATION_CAMPAIGN_STORE_ADAPTER={
  create({getIndexedDB}){
    function open(){
      return new Promise((resolve,reject)=>{
        const indexedDB=getIndexedDB();if(!indexedDB){reject(new Error("IndexedDB yok"));return;}
        const request=indexedDB.open("DendroGeoValidate",1);
        request.onupgradeneeded=event=>{const db=event.target.result;if(!db.objectStoreNames.contains("campaigns"))db.createObjectStore("campaigns",{keyPath:"id"});};
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
    }
    async function save(campaign){
      const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("campaigns","readwrite");tx.objectStore("campaigns").put(campaign);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});
    }
    async function load(parkId){
      const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("campaigns","readonly"),request=tx.objectStore("campaigns").getAll();request.onsuccess=()=>{const all=request.result||[];resolve(parkId?all.filter(campaign=>String(campaign.parkId)===String(parkId)):all);};request.onerror=()=>reject(request.error);});
    }
    async function remove(id){
      const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("campaigns","readwrite");tx.objectStore("campaigns").delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});
    }
    return Object.freeze({open,save,load,remove});
  }
};
