"use strict";
/* Owns only the optional account archive. Never mutates a park, project,
 * waypoint, accepted surface, raster or scientific calculation. */
(function(root){
 const schema="dendrogeo/live-map-project-snapshot/1";
 const key=id=>[id.ownerId,id.projectId,id.parkId].join(":");
 const matches=(snapshot,id)=>snapshot?.schema===schema&&snapshot.ownerId===id.ownerId&&
  snapshot.projectId===id.projectId&&snapshot.parkId===id.parkId&&
  snapshot.geometry===id.geometry&&snapshot.engine===id.engine&&
  Number.isFinite(Date.parse(snapshot.savedAt));
 function create({client,device,now=()=>Date.now(),warn=(...args)=>console.warn(...args)}){
  const lastWrite=new Map(),forceWrite=new Set();
  const rows=id=>client.from("project_workspace_archives")
   .select("payload").eq("owner",id.ownerId).eq("project_id",id.projectId)
   .eq("park_id",id.parkId);
  return Object.freeze({
   flush:id=>forceWrite.add(key(id)),
   async read(id){
    let local=null,remote=null;
    try{local=await device.read(id);}catch(error){warn("DENDROGEO · cihaz arşivi okunamadı:",error.message);}
    try{const {data,error}=await rows(id).maybeSingle();if(error)throw error;remote=data?.payload;}
    catch(error){warn("DENDROGEO · hesap arşivi okunamadı:",error.message);}
    if(!matches(local,id))local=null;
    if(!matches(remote,id))remote=null;
    const latest=remote&&(!local||Date.parse(remote.savedAt)>Date.parse(local.savedAt))?remote:local;
    if(latest===remote){try{await device.save(id,remote);}catch{ /* cloud copy remains readable */ }}
    return latest;
   },
   async save(id,snapshot){
    const k=key(id),urgent=forceWrite.delete(k);
    if(!matches(snapshot,id))throw Error("Proje çalışma arşivi kapsamı geçersiz.");
    let local=false,account=false,deviceError=null;
    try{await device.save(id,snapshot);local=true;}catch(error){deviceError=error;}
    if(urgent||now()-(lastWrite.get(k)||0)>30000){
     try{
      const body=JSON.stringify(snapshot);
      if(new TextEncoder().encode(body).length>8388608)throw Error("Hesap arşivi 8 MB sınırını aşıyor; cihaz kopyası korundu.");
      const {data:existing,error:readError}=await rows(id).maybeSingle();
      if(readError)throw readError;
      if(Date.parse(existing?.payload?.savedAt||"")>Date.parse(snapshot.savedAt))
       throw Error("Başka cihazda daha yeni proje arşivi var; eski görüntü üzerine yazılmadı.");
      const {error}=await client.from("project_workspace_archives").upsert({
       owner:id.ownerId,project_id:id.projectId,park_id:id.parkId,payload:snapshot
      },{onConflict:"owner,project_id,park_id"});
      if(error)throw error;
      account=true;lastWrite.set(k,now());
     }catch(error){warn("DENDROGEO · hesap arşivi kaydedilemedi:",error.message);}
    }
    if(!local&&!account)throw deviceError||Error("Proje çalışma arşivi kaydedilemedi.");
    return {local,account};
   }
  });
 }
 root.DG_LIVE_MAP_PROJECT_ACCOUNT_STORE=Object.freeze({create});
})(window);
