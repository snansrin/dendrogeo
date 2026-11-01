"use strict";
/* Persist already computed evidence and grid cells exactly, without deriving
 * new classifications, editing a park or mutating accepted records. */
(function(root){
 const schema="dendrogeo/live-map-project-snapshot/1";
 function reviewBasis(state){const rec=state?.record;if(!rec)return null;
  return JSON.stringify([rec.fingerprint,rec.scannedAt,rec.period,state.editing,rec.sens,rec.corrections,rec.features,rec.useObjects]);
 }
 function identity({ownerId,projectId,parkId,geometry,engine}){
  if(!ownerId||!Number.isSafeInteger(projectId)||!Number.isSafeInteger(parkId)||!geometry?.outer?.length)return null;
  return {ownerId:String(ownerId),projectId,parkId,geometry:JSON.stringify([geometry.outer,geometry.inner||[]]),engine:String(engine||"")};
 }
 function create({store,capture,apply}){
  async function save(input){const id=identity(input);if(!id)throw Error("Proje kimliği veya kayıtlı sınır eksik.");
   const state=capture();if(!state?.analysis&&!state?.grid?.cells?.length)return {saved:false,empty:true};
   const snapshot={schema,...id,savedAt:new Date().toISOString(),state};const saved=await store.save(id,snapshot);
   return {saved:true,scan:!!state.analysis,grid:state.grid?.cells?.length||0,account:!!saved?.account};
  }
  async function restore(input){const id=identity(input);if(!id)return {restored:false,reason:"identity"};
   const snapshot=await store.read(id);
   if(!snapshot)return {restored:false,reason:"missing"};
   if(snapshot.schema!==schema||snapshot.ownerId!==id.ownerId||snapshot.projectId!==id.projectId||snapshot.parkId!==id.parkId||snapshot.geometry!==id.geometry||snapshot.engine!==id.engine)return {restored:false,reason:"changed"};
   const state=snapshot.state;
   if(!state||(!state.analysis&&!state.grid?.cells?.length))return {restored:false,reason:"empty"};
   const result=await apply(state,id);
   return {restored:!!(result?.scan||result?.grid),scan:!!result?.scan,grid:Number(result?.grid||0),savedAt:snapshot.savedAt,source:snapshot.archiveSource==="account"?"account":"device"};
  }
  return Object.freeze({save,restore});
 }
 root.DG_LIVE_MAP_PROJECT_SNAPSHOT=Object.freeze({create,reviewBasis});
})(window);
