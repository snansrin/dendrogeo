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
 let pendingTimer=0,running=false,observer=null,parkObserver=null,observedHost=null;
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

 // Targeted Sentinel-2 second pass for ONLY cells the original QC still
 // marks uncertain. No spectral thresholds, geometry, accepted results or
 // manual decisions are overridden. Non-water land evidence must satisfy
 // the frozen three-observation, index-based validator exactly.
 const LAND=new Set(["green","hard","bare"]);
 const CELL_LIMIT=120;
 let rechecking=false,lastReviewMessage="";
 const automaticSessions=new WeakMap();
 function maybeRecheckAfterScan(){
  const s=state(),rec=s?.record;
  // The core scan is complete (fresh profile + scannedAt) and the user has
  // no active drawing/brush/accept. One automatic evidence-only pass per
  // record and scan date; a failed retry remains manually available.
  if(!rec?.scannedAt||!rec.profile?.cells||!s.geometry||
      !s.editing||s.rawView||s.busy||s.saving||s.exporting||
      s.draw||s.brush||rechecking)return;
  const session=[s.epoch,rec.scannedAt,rec.period,s.partitionVersion].join("|");
  if(automaticSessions.get(rec)===session)return;
  if(!missingParts().length)return;
  automaticSessions.set(rec,session);
  void recheckMissing();
 }
 const missingParts=()=>{
  const s=state();if(!s?.geometry||!s.record||s.rawView||typeof dgSensParts!=="function")return[];
  const pending=new Map();
  for(const p of dgSensParts()){
   if(p?.method!=="review-cell"||p.type!=="other"||!p.cell)continue;
   if((p.cell.rasterClassKey||p.cell.classKey)!=="water")continue;
   if(s.record.corrections?.[p.key]?.method==="visual-cell")continue;
   pending.set(p.key,p.cell);
  }
  return [...pending.entries()].map(([key,cell])=>({key,cell}));
 };
 async function recheckMissing(){
  const s=state(),rec=s?.record;
  if(rechecking||!s?.geometry||!rec||s.busy||s.saving||s.exporting||
    s.rawView||s.draw||s.brush)return{checked:0,resolved:0,remaining:null,reason:"busy"};
  if(typeof dgSensParts!=="function"||typeof window.DG_LC_S2?.profile!=="function"||
     typeof window.DG_LC_VALIDATE?.spectralLandPredict!=="function")
    return{checked:0,resolved:0,remaining:null,reason:"no-evidence-provider"};
  const pending=missingParts();
  if(!pending.length)return{checked:0,resolved:0,remaining:0};
  const queue=pending.slice(0,CELL_LIMIT),epoch=s.epoch,src=rec.fingerprint,part=s.partitionVersion;
  const action=document.getElementById("dgUxRetryWater");
  rechecking=true;if(action)action.disabled=true;
  const output=document.getElementById("dgUxDraftStatus");
  const say=message=>{
   lastReviewMessage=message;
   // The core rebuilds its panel after the scan; never write to a detached
   // old status node and lose the second-pass result.
   const current=document.getElementById("dgUxDraftStatus");
   if(current)current.textContent=message;
  };
  say(queue.length+" belirsiz hücre için yeni Sentinel-2 gözlemleri inceleniyor…");
  try{
   const mode=rec.period==="latest"?"ytd":"latest";
   const profile=await window.DG_LC_S2.profile(queue.map(p=>p.cell),
     typeof PARK_POLY!=="undefined"?PARK_POLY:[],
     {year:typeof DG_LC_LAST!=="undefined"?DG_LC_LAST?.report?.year||2021:2021,
      mode});
   if(s.epoch!==epoch||s.record!==rec||rec.fingerprint!==src||
      s.partitionVersion!==part||s.rawView||s.busy||s.saving||s.draw||s.brush)
    return{checked:0,resolved:0,remaining:null,reason:"park-changed"};
   const newData={};const byClass={},rejected={nodata:0,ambiguous:0,missing:0};
   for(const {key} of queue){
    if(rec.corrections?.[key]?.method==="visual-cell")continue;
    const e=profile?.cells?.[key];if(!e){rejected.missing++;continue;}
    const target=window.DG_LC_VALIDATE.spectralLandPredict(e,
      {green:50,water:50,hard:50,bare:50});
    if(!LAND.has(target)){rejected[target==="nodata"?"nodata":"ambiguous"]++;continue;}
    newData[key]=e;
    byClass[target]=(byClass[target]||0)+1;
   }
   const resolved=Object.keys(newData).length;
   if(resolved){
    const existing=rec.profile||{};
    rec.profile={...existing,
     cells:{...(existing.cells||{}),...newData},
     supplementalSpectral:{
      source:"Sentinel-2 L2A targeted recheck",
      period:mode,
      cellsResolved:resolved,
      checked:queue.length,
      evidenceVersion:profile?.evidenceVersion||null,
      timestamp:new Date().toISOString()
     }};
    if(typeof dgSensDirty==="function")dgSensDirty();
    else{rec.draftDirty=true;s.editing=true;s.visualVersion=(s.visualVersion||0)+1;}
    if(typeof dgSensRefreshLayer==="function")void dgSensRefreshLayer();
    if(typeof dgSensUpdateSummary==="function")dgSensUpdateSummary();
    if(typeof dgSensSave==="function")void dgSensSave();
   }
   const remaining=typeof dgSensWaterBoundaryUnresolved==="function"?
     dgSensWaterBoundaryUnresolved():Math.max(0,pending.length-resolved);
   say("Uyduyla tekrar incelendi: "+queue.length+" hücre; bilimsel olarak çözülen: "+
    resolved+" ("+Object.entries(byClass).map(([k,n])=>k+": "+n).join(", ")+
    "); kalan: "+remaining+". Kanıt özeti: görüntü/veri yok "+rejected.missing+
    ", yeterli gözlem yok "+rejected.nodata+", kararsız spektrum "+rejected.ambiguous+". "+
    (remaining?"Kalanları haritada doğrulamadan kabul edilemez.":"Sonucu kontrol ederek Kabul et ve kaydet yapın."));
   return{checked:queue.length,resolved,remaining,byClass,rejected};
  }catch(error){
   const message="Eksik hücrelere yönelik uydu kontrolü tamamlanamadı: "+String(error?.message||error);
   say(message);return{checked:queue.length,resolved:0,remaining:pending.length,reason:"service-error"};
  }finally{rechecking=false;if(action?.isConnected)action.disabled=false;}
 }
 function syncWaterReviewAction(){
  const section=document.getElementById("dgUxDraftSave"),s=state();
  const status=document.getElementById("dgUxDraftStatus");
  if(lastReviewMessage&&status&&status.textContent!==lastReviewMessage)status.textContent=lastReviewMessage;
  if(!section||!s?.record||!s.geometry)return;
  const row=section.querySelector?.(".dg-ux-draft-actions");if(!row)return;
  let button=document.getElementById("dgUxRetryWater");
  const num=missingParts().length;
  if(!num){button?.remove();return;}
  if(!button){
   button=document.createElement("button");
   button.id="dgUxRetryWater";button.type="button";
   button.className="dg-png-btn ghost sm";
   button.addEventListener("click",()=>{void recheckMissing();});
   row.append(button);
  }
  button.textContent="🛰 Eksik "+num+" hücreyi uyduyla kontrol et";
  button.disabled=rechecking||s.busy||s.saving||!!s.draw||!!s.brush;
 }
 function queue(){
  if(pendingTimer)return;
  pendingTimer=setTimeout(()=>{pendingTimer=0;restore();syncWaterReviewAction();maybeRecheckAfterScan();},200);
 }
 // #lcSens is created only when a park is selected (parkInfo.innerHTML),
 // AFTER DOMContentLoaded. An observer installed on a missing element silently
 // disabled the earlier satellite retry and draft controls for the whole visit.
 // Watch the existing park container for NEW panel instances, and attach to
 // each actual panel. No polling, and no changes to the locked scanner.
 function attachSurfacePanel(){
  const host=document.getElementById("lcSens");
  if(!host||host===observedHost)return;
  observer?.disconnect?.();
  observedHost=host;
  if(typeof MutationObserver==="function"){
   observer=new MutationObserver(queue);
   observer.observe(host,{childList:true,subtree:false});
  }
  queue();
 }
 function init(){
  attachSurfacePanel();
  const park=document.getElementById("parkInfo");
  if(park&&typeof MutationObserver==="function"){
   parkObserver=new MutationObserver(attachSurfacePanel);
   parkObserver.observe(park,{childList:true,subtree:false});
  }
  // If a late-mounted scientific panel is created and a scan starts without
  // mutating the outer park container, reattach on that real user gesture.
  document.addEventListener?.("click",event=>{
   if(event.target?.closest?.("#dgSensScanBtn")){attachSurfacePanel();queue();}
  },true);
 }
 window.DG_GIS_WATER_NEIGHBOUR={restore,stats,queue,missingParts,recheckMissing,syncWaterReviewAction,maybeRecheckAfterScan};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();