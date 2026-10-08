/* DendroGeo | recession neighbour inference, UI sidecar only.
 * The user asked to classify receded water by nearest verified land cover.
 * We never change the frozen raster, parser, scientific source, thresholds or
 * accepted snapshots. Inferences are new, reversible draft corrections with
 * explicit provenance, applied only to shoreline-excluded raster-water cells.
 */
(function(){
 "use strict";
 const LAND=new Set(["green","hard","bare"]);
 const state=()=>window.DG_LC_SENS?.state;
 const key=p=>String(p?.key??(p?.cell?(p.cell.row+":"+p.cell.col):""));
 const classKey=c=>String(c?.row)+":"+String(c?.col);
 let scheduled=0,processing=false;
 let lastAttempt="";
 const position=cell=>{
  const c=cell?.center;
  if(Number.isFinite(Number(c?.lat))&&Number.isFinite(Number(c?.lon??c?.lng))){
   return {lat:Number(c.lat),lon:Number(c.lon??c.lng)};
  }
  return Number.isFinite(Number(cell?.row))&&Number.isFinite(Number(cell?.col))?
    {row:Number(cell.row),col:Number(cell.col)}:null;
 };
 const distance=(a,b)=>{
  if(a.lat!=null&&b.lat!=null){
   const lat=(a.lat+b.lat)/2*Math.PI/180;
   const dx=(a.lon-b.lon)*111320*Math.cos(lat),dy=(a.lat-b.lat)*110540;
   return dx*dx+dy*dy;
  }
  if(a.row!=null&&b.row!=null){
   const dx=a.col-b.col,dy=a.row-b.row;return (dx*dx+dy*dy)*100;
  }
  return Infinity;
 };
 function propose(parts,corrections={}){
  if(!Array.isArray(parts)||!parts.length)return[];
  const candidates=new Map(),unresolved=new Map();
  for(const p of parts){
   if(!p?.cell)continue;
   const id=key(p),loc=position(p.cell),type=p.type;
   if(!id||!loc)continue;
   const base=p.cell.rasterClassKey||p.cell.classKey;
   if(base==="water"&&p.method==="review-cell"&&type==="other"&&!corrections[id]){
    unresolved.set(id,{key:id,cell:p.cell,pos:loc});
   }
   // Only already resolved, measured/reviewed land polygons are evidence.
   if(LAND.has(type)&&Number(p.areaM2)>0){
    const prev=candidates.get(id);
    if(!prev||Number(p.areaM2)>prev.area)
     candidates.set(id,{key:id,pos:loc,type,area:Number(p.areaM2)});
   }
  }
  const known=[...candidates.values()];
  if(!known.length)return[];
  const result=[];
  for(const entry of unresolved.values()){
   let winner=null,closest=Infinity;
   for(const neighbour of known){
    if(neighbour.key===entry.key)continue; // no self-voting
    const d=distance(entry.pos,neighbour.pos);
    if(d<closest||(d===closest&&neighbour.key<(winner?.key||"~"))){
     winner=neighbour;closest=d;
    }
   }
   if(!winner||!Number.isFinite(closest))continue;
   result.push({key:entry.key,cell:entry.cell,to:winner.type,
    neighbour:winner.key,distanceM:Math.sqrt(closest)});
  }
  return result;
 }
 function findPending(){
  const s=state();
  if(!s?.record||!s.geometry||s.rawView||!s.editing||s.busy||s.saving||s.draw||s.brush)return[];
  if(typeof dgSensParts!=="function")return[];
  return propose(dgSensParts(),s.record.corrections||{});
 }
 function apply({save=true}={}){
  const s=state(),pending=findPending();
  if(!s?.record||!pending.length)return {count:0,byClass:{},remaining:0};
  const rec=s.record,corrections=rec.corrections||{},ts=new Date().toISOString(),byClass={};
  // Transactional, deduplicated, reversible and traceable corrections.
  for(const item of pending){
   if(corrections[item.key])continue;
   corrections[item.key]={from:item.cell.rasterClassKey||item.cell.classKey,
    to:item.to,method:"visual-cell",ts,
    source:"spatial-nearest-inference",
    evidence:{nearestCellKey:item.neighbour,distanceM:Number(item.distanceM.toFixed(2)),
      classification:"provisional-spatial-inference-not-satellite-observation"}};
   byClass[item.to]=(byClass[item.to]||0)+1;
  }
  const count=Object.values(byClass).reduce((a,b)=>a+b,0);
  if(!count)return{count:0,byClass,remaining:0};
  rec.corrections=corrections;
  if(typeof dgSensDirty==="function")dgSensDirty();
  else{rec.draftDirty=true;s.editing=true;s.visualVersion=(s.visualVersion||0)+1;}
  const msg="Su çekilme bölgesindeki "+count+
   " hücre en yakın geçerli kara sınıfına TASLAK öneri olarak atandı (uydu doğrulaması değildir). "+
   "Sonucu inceleyip Kabul et ve kaydet ile onaylayın.";
  s.status=msg;
  if(typeof dgSensRefreshLayer==="function")void dgSensRefreshLayer();
  if(typeof dgSensUpdateSummary==="function")dgSensUpdateSummary();
  if(typeof dgSensUpdateStatus==="function")dgSensUpdateStatus();
  if(save&&typeof dgSensSave==="function")void dgSensSave();
  const still=typeof dgSensWaterBoundaryUnresolved==="function"?dgSensWaterBoundaryUnresolved():0;
  return {count,byClass,remaining:still};
 }
 function maybeApply(){
  const s=state();
  if(!s?.record||!s.editing||s.rawView||s.busy||s.saving||s.draw||s.brush||!s.geometry)return;
  const token=[s.epoch,s.partitionVersion,s.record?.id,s.record?.scannedAt,
    s.record?.features?.length,s.record?.objectVersion,s.record?.useObjects].join("|");
  if(token===lastAttempt||processing)return;
  lastAttempt=token;processing=true;
  try{apply({save:true});}catch(error){console.warn("Su çekilme komşuluk incelemesi:",error);}
  finally{processing=false;}
 }
 function queue(){
  if(scheduled)return;
  scheduled=setTimeout(()=>{scheduled=0;maybeApply();},250);
 }
 function init(){
  const host=document.getElementById("lcSens");
  if(!host)return;
  if(typeof MutationObserver==="function"){
   const observer=new MutationObserver(queue);
   observer.observe(host,{childList:true,subtree:false});
  }
  // The initial raster evidence can already be present before init.
  queue();
 }
 window.DG_GIS_WATER_NEIGHBOUR={propose,findPending,apply,maybeApply,queue};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();