"use strict";
/* Device-local, account/project-scoped snapshots. No remote writes or schema
 * migrations; original park, waypoint and accepted review rows are canonical. */
(function(root){
 function create(getIndexedDB,getClient=()=>null){
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
  async function readLocal(identity){const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction("snapshots","readonly"),request=tx.objectStore("snapshots").get(key(identity));
   request.onsuccess=()=>resolve(request.result?.snapshot||null);request.onerror=()=>reject(request.error);
   tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
  });}
  async function saveLocal(identity,snapshot){
   const body=JSON.stringify(snapshot);if(body.length>32*1024*1024)throw Error("Proje tarama önbelleği cihaz sınırını aşıyor; mevcut veriler silinmedi.");
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put({key:key(identity),snapshot:JSON.parse(body)});
    tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error("Proje anlık görüntüsü kaydedilemedi."));};
   });
  }
  // Account-sync is additive. Local IndexedDB remains available offline;
  // authenticated Supabase RLS enforces owner + accessible project/park scope.
  const lastSync=new Map();
  async function remoteRead(identity){
   const client=getClient();if(!client?.from)return null;
   const {data,error}=await client.from("project_workspace_snapshots").select("payload")
    .eq("owner",identity.ownerId).eq("project_id",identity.projectId).eq("park_id",identity.parkId).maybeSingle();
   if(error)throw error;
   return data?.payload||null;
  }
  async function remoteSave(identity,snapshot,{flush=false}={}){
   const client=getClient();if(!client?.from)return false;
   const body=JSON.stringify(snapshot);
   if(body.length>8*1024*1024)throw Error("Proje çalışma görüntüsü sunucu boyut sınırını aşıyor.");
   const itemKey=key(identity),now=Date.now();
   // Fast brush/slider changes are saved locally. Avoid excess Free Plan
   // writes while retaining an immediate flush on project exit or hiding.
   if(!flush&&now-(lastSync.get(itemKey)||0)<30000)return false;
   const {error}=await client.from("project_workspace_snapshots").upsert({
    owner:identity.ownerId,project_id:identity.projectId,park_id:identity.parkId,payload:snapshot
   },{onConflict:"owner,project_id,park_id"});
   if(error)throw error;lastSync.set(itemKey,now);return true;
  }
  async function read(identity){
   let local=null,cloud=null;
   try{local=await readLocal(identity);}catch(error){console.warn("DENDROGEO · cihaz proje arşivi okunamadı:",error.message);}
   try{cloud=await remoteRead(identity);}catch(error){console.warn("DENDROGEO · hesap proje arşivi okunamadı:",error.message);}
   return cloud&&(!local||Date.parse(cloud.savedAt)>Date.parse(local.savedAt))?cloud:local;
  }
  async function save(identity,snapshot,options={}){
   let deviceError=null,cloud=false;
   try{await saveLocal(identity,snapshot);}catch(error){deviceError=error;}
   try{cloud=await remoteSave(identity,snapshot,options);}catch(error){console.warn("DENDROGEO · hesap proje arşivi kaydedilemedi:",error.message);}
   if(deviceError&&!cloud)throw deviceError;
   return {device:!deviceError,cloud};
  }
  return Object.freeze({read,save});
 }
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE=Object.freeze({create});
})(window);
