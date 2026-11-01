"use strict";
/* Exact, account/project/park scoped snapshots. IndexedDB remains an offline
 * copy; per-device Supabase backups allow the same saved evidence to reopen
 * on another signed-in device without reclassifying or rescanning a pixel. */
(function(root){
 const table="project_workspace_snapshots",MAX_LOCAL=32*1024*1024,MAX_REMOTE=7*1024*1024;
 function create(getIndexedDB,getClient){
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
  function matches(id,snapshot){
   return !!(snapshot&&snapshot.ownerId===String(id.ownerId)&&snapshot.projectId===id.projectId&&
    snapshot.parkId===id.parkId&&snapshot.geometry===id.geometry&&snapshot.engine===id.engine);
  }
  async function readLocal(identity){const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction("snapshots","readonly"),request=tx.objectStore("snapshots").get(key(identity));
   request.onsuccess=()=>resolve(request.result?.snapshot||null);request.onerror=()=>reject(request.error);
   tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
  });}
  async function saveLocal(identity,snapshot){
   const body=JSON.stringify(snapshot);if(body.length>MAX_LOCAL)throw Error("Proje tarama önbelleği cihaz sınırını aşıyor; mevcut veriler silinmedi.");
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put({key:key(identity),snapshot:JSON.parse(body)});
    tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error("Proje anlık görüntüsü kaydedilemedi."));};
   });
  }
  let memoDeviceId=null;
  function deviceId(){
   if(memoDeviceId)return memoDeviceId;
   const storageKey="dg_live_projects_device_id";
   try{const saved=root.localStorage?.getItem(storageKey);
    if(saved&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved))return memoDeviceId=saved;
   }catch{}
   const random=()=>Math.floor(Math.random()*16).toString(16);
   const id=typeof root.crypto?.randomUUID==="function"?root.crypto.randomUUID():
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>c==="x"?random():((Math.floor(Math.random()*4)+8).toString(16)));
   memoDeviceId=id;try{root.localStorage?.setItem(storageKey,id);}catch{}
   return id;
  }
  function client(){return typeof getClient==="function"?getClient():null;}
  function toBase64(bytes){
   let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
   return root.btoa(binary);
  }
  function fromBase64(value){const binary=root.atob(value),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
  }
  async function pack(snapshot){
   const body=JSON.stringify(snapshot),bytes=new root.Blob([body]).size;
   if(bytes<=1024*1024)return {codec:"json",snapshot};
   if(!root.CompressionStream||!root.btoa||!root.Response)throw Error("Büyük arşiv için bu tarayıcıda sıkıştırma desteği yok.");
   const stream=new root.Blob([body]).stream().pipeThrough(new root.CompressionStream("gzip"));
   const compressed=new Uint8Array(await new root.Response(stream).arrayBuffer());
   if(compressed.length*4/3>MAX_REMOTE)throw Error("Proje anlık görüntüsü hesap yedeği sınırını aşıyor.");
   return {codec:"gzip-base64",data:toBase64(compressed)};
  }
  async function unpack(value){
   if(value?.codec==="json")return value.snapshot||null;
   if(value?.codec!=="gzip-base64"||typeof value.data!=="string"||!root.DecompressionStream||!root.atob||!root.Response)return null;
   if(value.data.length>MAX_REMOTE)return null;
   const stream=new root.Blob([fromBase64(value.data)]).stream().pipeThrough(new root.DecompressionStream("gzip"));
   const body=await new root.Response(stream).text();
   if(body.length>MAX_LOCAL)return null;
   return JSON.parse(body);
  }
  async function readAccount(id){
   const db=client();if(!db)return null;
   const {data,error}=await db.from(table).select("payload,updated_at").eq("owner",id.ownerId)
    .eq("project_id",id.projectId).eq("park_id",id.parkId).order("updated_at",{ascending:false}).limit(8);
   if(error)throw error;
   for(const row of data||[]){
    try{const snapshot=await unpack(row.payload);if(matches(id,snapshot))return {...snapshot,archiveSource:"account"};}
    catch(error){console.warn("DENDROGEO · hesap arşivi okunamadı:",error.message);}
   }
   return null;
  }
  let uploadQueue=Promise.resolve();
  async function writeAccount(id,snapshot){
   const db=client();if(!db)return false;
   const payload=await pack(snapshot);
   const row={owner:String(id.ownerId),project_id:id.projectId,park_id:id.parkId,
    device_id:deviceId(),payload,updated_at:new Date().toISOString()};
   const {error}=await db.from(table).upsert(row,{onConflict:"owner,project_id,park_id,device_id"});
   if(error)throw error;
   return true;
  }
  async function read(identity){
   key(identity);
   // An unavailable offline store must not hide a valid account archive.
   const [local,remote]=await Promise.allSettled([readLocal(identity),readAccount(identity)]);
   const localSnapshot=local.status==="fulfilled"&&matches(identity,local.value)?{...local.value,archiveSource:"device"}:null;
   const remoteSnapshot=remote.status==="fulfilled"?remote.value:null;
   if(localSnapshot&&remoteSnapshot){
    return Date.parse(remoteSnapshot.savedAt||"")>Date.parse(localSnapshot.savedAt||"")?remoteSnapshot:localSnapshot;
   }
   if(localSnapshot||remoteSnapshot)return localSnapshot||remoteSnapshot;
   if(local.status==="rejected"&&remote.status==="rejected")throw local.reason;
   if(local.status==="rejected"&&!client())throw local.reason;
   return null;
  }
  async function save(identity,snapshot){
   key(identity);
   let offline=false,account=false,localError=null,remoteError=null;
   try{await saveLocal(identity,snapshot);offline=true;}catch(error){localError=error;}
   try{
    // Serialize network writes from a single device so a delayed request
    // cannot overwrite a newer snapshot captured a moment later.
    const queued=uploadQueue.catch(()=>{}).then(()=>writeAccount(identity,snapshot));
    uploadQueue=queued;account=await queued;
   }catch(error){remoteError=error;console.warn("DENDROGEO · hesap anlık görüntüsü:",error.message);}
   if(!offline&&!account)throw localError||remoteError||Error("Proje anlık görüntüsü saklanamadı.");
   return {offline,account};
  }
  return Object.freeze({read,save});
 }
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE=Object.freeze({create});
})(window);
