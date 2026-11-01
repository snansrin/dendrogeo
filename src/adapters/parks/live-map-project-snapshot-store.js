"use strict";
/* Device-local, account/project-scoped snapshots. No remote writes or schema
 * migrations; original park, waypoint and accepted review rows are canonical. */
(function(root){
 function create(getIndexedDB){
  function open(){return new Promise((resolve,reject)=>{
   const factory=getIndexedDB();if(!factory)return reject(Error("Cihazda kalıcı çalışma alanı kullanılamıyor."));
   const request=factory.open("DendroGeoLiveProjects",1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots",{keyPath:"key"});};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error("Proje arşivi açılamadı."));
   request.onblocked=()=>reject(Error("Proje arşivi başka bir sekmede kilitli."));
  });}
  const key=({ownerId,projectId,parkId})=>{
   if(!ownerId||!Number.isSafeInteger(projectId)||projectId<=0||!Number.isSafeInteger(parkId)||parkId<=0)throw Error("Proje kaydı için hesap, proje ve park kimliği gerekli.");
   return String(ownerId)+":"+projectId+":"+parkId;
  };
  async function read(identity){const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction("snapshots","readonly"),request=tx.objectStore("snapshots").get(key(identity));
   request.onsuccess=()=>resolve(request.result?.snapshot||null);request.onerror=()=>reject(request.error);
   tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
  });}
  async function save(identity,snapshot){
   const body=JSON.stringify(snapshot);if(body.length>32*1024*1024)throw Error("Proje tarama önbelleği cihaz sınırını aşıyor; mevcut veriler silinmedi.");
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put({key:key(identity),snapshot:JSON.parse(body)});
    tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error("Proje anlık görüntüsü kaydedilemedi."));};
   });
  }
  return Object.freeze({read,save});
 }
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE=Object.freeze({create});
})(window);
