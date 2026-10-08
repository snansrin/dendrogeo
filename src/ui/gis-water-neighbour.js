/* DendroGeo · restore approved surface source behaviour.
 * Older UI sidecar inferred "visual-cell" land classes from proximity
 * without spectral evidence. It could mask Göksu's thin hard-surface paths.
 * This is a one-time, provenance-exact DRAFT rollback: NO core override,
 * no acceptance bypass, no raster/feature/report edits, no new inferences.
 * The 51 pinned source files remain byte-for-byte unchanged.
 */
(function(){
 "use strict";
 const SOURCE="spatial-nearest-inference";
 const state=()=>window.DG_LC_SENS?.state;
 let pendingTimer=0,running=false,observer=null;
 const stats=rec=>{
  const entries=Object.entries(rec?.corrections||{});
  const targets=entries.filter(([,decision])=>decision&&decision.source===SOURCE);
  const byClass={};
  for(const [,d] of targets)byClass[d.to]=(byClass[d.to]||0)+1;
  return {count:targets.length,byClass,keys:targets.map(([key])=>key)};
 };
 function restore(){
  const s=state(),rec=s?.record;
  if(!rec||!s.geometry||s.rawView||s.busy||s.saving||s.exporting||
      s.draw||s.brush||running)return{removed:0,skipped:true};
  const found=stats(rec);
  if(!found.count)return{removed:0,skipped:false};
  running=true;
  try{
   const latest=rec.corrections||{};
   // The precise source marker is mandatory. Preserve even another user's
   // manually entered value with an identical class.
   for(const key of found.keys)if(latest[key]?.source===SOURCE)delete latest[key];
   const removed=found.keys.length;
   if(!removed)return{removed:0,skipped:false};
   if(typeof dgSensDirty==="function")dgSensDirty();
   else{
    s.visualVersion=(s.visualVersion||0)+1;
    s.editing=true;
    rec.draftDirty=true;
   }
   // Never touch acceptedResult, acceptedAreas, acceptedAt, remote revision
   // or published DOI history. The cleaned map is a NEW DRAFT preview.
   s.status="Kilitli yüzey çekirdeği geri yüklendi: "+removed+
     " önceki komşuluk tahmini taslaktan kaldırıldı. Sert yollar ve su sınırını "+
     "yeniden inceleyin; onaylanmış geçmiş raporlar değişmedi.";
   if(typeof dgSensUpdateSummary==="function")dgSensUpdateSummary();
   if(typeof dgSensUpdateStatus==="function")dgSensUpdateStatus();
   if(typeof dgSensRefreshLayer==="function")void dgSensRefreshLayer();
   if(typeof dgSensSave==="function")void dgSensSave(); // local draft only
   return{removed,skipped:false};
  }finally{running=false;}
 }
 function queue(){
  if(pendingTimer)return;
  pendingTimer=setTimeout(()=>{pendingTimer=0;restore();},200);
 }
 function init(){
  const host=document.getElementById("lcSens");
  if(!host)return;
  if(typeof MutationObserver==="function"){
   observer=new MutationObserver(queue);
   observer.observe(host,{childList:true,subtree:false});
  }
  queue();
 }
 window.DG_GIS_WATER_NEIGHBOUR={restore,stats,queue};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();