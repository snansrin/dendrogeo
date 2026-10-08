/* DendroGeo · non-destructive account draft for reviewed park surfaces.
 * Does NOT bypass the scientific acceptance QC: unknown raster-water cells
 * remain "other", with original raster and published result untouched. */
(function(){
 "use strict";
 let pendingLayer=null,pendingIdentity=null,observer=null,queued=0,busy=false;
 const $=id=>document.getElementById(id);
 const state=()=>window.DG_LC_SENS?.state;
 const message=(value,kind="info")=>{
  const n=$("dgUxDraftStatus");if(n){n.textContent=value;n.dataset.status=kind;}
 };
 const clone=value=>typeof structuredClone==="function"?structuredClone(value):JSON.parse(JSON.stringify(value));
 function pendingParts(){
  const s=state();
  if(!s?.record||!s.geometry||s.rawView||typeof dgSensParts!=="function")return[];
  return dgSensParts().filter(p=>p?.method==="review-cell"&&p.type==="other"&&
   (p.cell?.rasterClassKey||p.cell?.classKey)==="water");
 }
 function clearHighlight(){
  if(pendingLayer&&typeof map!=="undefined"&&map?.removeLayer)map.removeLayer(pendingLayer);
  pendingLayer=null;pendingIdentity=null;
 }
 function highlightPending(){
  const s=state(),ref=typeof map!=="undefined"?map:null;
  if(pendingLayer){clearHighlight();message("Belirsiz alan vurgulaması kapatıldı.");return;}
  if(!ref||!window.L||!s?.geometry||!s.epsg||typeof dgSurfaceUnproject!=="function"){
   message("Park haritası hazır değil; yüzey analizini açın.","warn");return;
  }
  let unresolved;
  try{unresolved=pendingParts();}catch(error){
   message("Belirsiz hücreler çizilemedi: "+String(error?.message||error),"warn");return;
  }
  if(!unresolved.length){message("Su sınırı dışında bekleyen belirsiz hücre görünmüyor.");return;}
  const group=L.layerGroup();
  try{
   for(const part of unresolved){
    const polygons=dgSurfaceUnproject(part.geom,s.epsg)
      .map(poly=>poly.map(ring=>ring.map(([lon,lat])=>[lat,lon])));
    L.polygon(polygons,{
     color:"#d97706",weight:2,fillColor:"#f59e0b",fillOpacity:.19,
     opacity:.95,interactive:false
    }).addTo(group);
   }
   group.addTo(ref);
   pendingLayer=group;
   pendingIdentity={record:s.record,epoch:s.epoch,visualVersion:s.visualVersion,partitionVersion:s.partitionVersion};
   message(unresolved.length+" belirsiz raster-su hücresi turuncu işaretlendi. Görüntüyü inceleyip hücre veya sınır düzeltmesi yapabilirsiniz.");
  }catch(error){group.remove?.();message("Belirsiz sınırlar çizilemedi: "+String(error?.message||error),"warn");}
 }
 async function saveDraft(){
  const s=state(),rec=s?.record;
  if(busy)return false;
  if(!rec||!s.geometry||s.rawView||s.busy||s.saving||s.exporting||s.brush||s.draw){
   message("Taslağı kaydetmeden önce harita analizini ve etkin çizim/fırça işlemini tamamlayın.","warn");
   return false;
  }
  if(!rec.owner||!rec.parkId){
   message("Projeye kaydetmek için hesabınıza giriş yapın ve kayıtlı Göksu Parkı projenizi seçin.","warn");
   return false;
  }
  if(!s.editing&&!rec.draftDirty){
   message("Bu çalışma zaten kabul edilmiş kayıt olarak hesabınızda bulunuyor.","info");
   return true;
  }
  if(typeof window.DG_SURFACE_REVIEW?.save!=="function"||typeof window.DG_SURFACE_REVIEW?.load!=="function"){
   message("Hesap kaydı servisi hazır değil. Mevcut cihaz taslağına dokunulmadı.","warn");return false;
  }
  let count;
  try{count=new Set(pendingParts().map(p=>p.key)).size;}catch(error){
   message("Su belirsizlik denetimi tamamlanamadı. Taslak değiştirilmedi.","warn");return false;
  }
  const time=new Date().toISOString(),epoch=s.epoch;
  const snapshot=clone(rec);
  snapshot.draftDirty=true;
  snapshot.modifiedAt=time;
  snapshot.draftSavedAt=time;
  snapshot.draftWaterUnresolved=count;
  // Never promote a draft to an accepted result, or erase a previous accepted report.
  // The existing server-side ownership/RLS and revision conflict checks still apply.
  const button=$("dgUxSaveProjectDraft");
  busy=true;s.saving=true;if(button)button.disabled=true;
  message("Göksu yüzey düzenlemeleri projenizin hesap kaydına gönderiliyor…");
  try{
   const revision=await window.DG_SURFACE_REVIEW.save(snapshot,s.revision);
   if(s.record!==rec||s.epoch!==epoch)return false;
   // The remote write succeeded. Record the revision before any optional
   // cache verification to prevent a second save from raising a false conflict.
   s.revision=revision;
   Object.assign(rec,{
    serverRevision:revision,modifiedAt:time,draftDirty:true,
    draftSavedAt:time,draftWaterUnresolved:count
   });
   let localSaved=false;
   if(typeof window.DG_LC_VALIDATE?.saveCampaign==="function"){
    try{await window.DG_LC_VALIDATE.saveCampaign(clone(rec));localSaved=true;}
    catch(error){console.warn("DENDROGEO · cihaz taslak önbelleği:",String(error?.message||error));}
   }
   let verified=false;
   try{
    const remote=await window.DG_SURFACE_REVIEW.load(rec.parkId,rec.owner);
    verified=Number(remote?.revision)===Number(revision)&&
     remote?.payload?.id===snapshot.id&&
     remote?.payload?.fingerprint===snapshot.fingerprint&&
     remote?.payload?.modifiedAt===time&&
     remote?.payload?.draftDirty===true&&
     Number(remote?.payload?.draftWaterUnresolved)===count;
   }catch(error){console.warn("DENDROGEO · taslak geri okuma:",String(error?.message||error));}
   const suffix=count?" · "+count+" belirsiz raster-su hücresi taslakta korundu.":" · Belirsiz su hücresi yok.";
   if(verified)message("✓ Park yüzeyi düzenlemeleri projenizin hesabına TASLAK olarak kaydedildi"+suffix+
    (localSaved?"":" · Cihaz önbelleği güncellenemedi."),"ok");
   else message("Hesap sunucusu taslağı yazdı fakat yeniden okuma doğrulanamadı. Kaydı projeden kontrol edin."+
    suffix,"warn");
   return verified;
  }catch(error){
   // A failed write must not alter the current user's edited geometry or the
   // earlier accepted publication. The core's local cache remains available.
   message("Hesaba taslak kaydedilemedi: "+String(error?.message||error)+
    " · Mevcut harita düzeltmeleri silinmedi.","error");
   return false;
  }finally{
   busy=false;
   if(s.record===rec&&s.epoch===epoch)s.saving=false;
   if(button?.isConnected)button.disabled=false;
  }
 }
 function sync(){
  const host=$("lcSens"),s=state();
  const accept=host?.querySelector?.("#dgSensAcceptBtn");
  if(!accept||!s?.record||!s.geometry||s.rawView){
   clearHighlight();
   host?.querySelector?.("#dgUxDraftSave")?.remove();return;
  }
  if(pendingLayer&&(pendingIdentity?.record!==s.record||pendingIdentity?.epoch!==s.epoch||
    pendingIdentity?.visualVersion!==s.visualVersion||pendingIdentity?.partitionVersion!==s.partitionVersion))
   clearHighlight();
  let section=$("dgUxDraftSave");
  if(!section){
   section=document.createElement("section");
   section.id="dgUxDraftSave";section.className="dg-ux-draft-save";
   const row=document.createElement("div");row.className="dg-ux-draft-actions";
   const save=document.createElement("button");
   save.id="dgUxSaveProjectDraft";save.type="button";save.className="dg-png-btn ghost sm";
   save.textContent="💾 Projeme taslak kaydet";
   save.addEventListener("click",saveDraft);
   const pending=document.createElement("button");
   pending.id="dgUxShowPendingWater";pending.type="button";pending.className="dg-png-btn ghost sm";
   pending.textContent="◌ Belirsiz su hücrelerini göster";
   pending.addEventListener("click",highlightPending);
   row.append(save,pending);
   const hint=document.createElement("p");hint.className="dg-ux-draft-hint";
   hint.textContent="Taslak hesabınıza kaydedilir; belirsiz hücreler ve eski kabul edilmiş rapor değiştirilmez. Kesin sonuç için eksik hücreleri doğrulayıp Kabul et ve kaydet kullanın.";
   const status=document.createElement("p");status.id="dgUxDraftStatus";
   status.className="dg-ux-draft-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
   section.append(row,hint,status);
   accept.closest(".dg-sens-actions")?.after(section);
  }
  const disabled=busy||s.busy||s.saving||s.exporting||!!s.brush||!!s.draw;
  const save=$("dgUxSaveProjectDraft"),pending=$("dgUxShowPendingWater");
  if(save)save.disabled=disabled;
  if(pending)pending.disabled=disabled;
 }
 function schedule(){
  if(queued)return;
  queued=setTimeout(()=>{queued=0;sync();},90);
 }
 function init(){
  const host=$("lcSens");
  if(!host)return;
  sync();
  if(typeof MutationObserver==="function"){
   observer=new MutationObserver(schedule);
   observer.observe(host,{childList:true,subtree:false});
  }
 }
 window.DG_GIS_PROJECT_DRAFT={saveDraft,highlightPending,pendingParts,sync};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
