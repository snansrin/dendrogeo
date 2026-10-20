"use strict";
(function(root){
 let photoUi;
 function mountOwnerArchiveControls(){
  // This UI module is NOT fetched on public landing or at startup.
  // The admin-only storage summary renders after the panel is opened.
  if(!photoUi){
   photoUi=import('/src/ui/photo-admin-controls.mjs')
    .then(()=>root.DG_PHOTO_ARCHIVE_UI?.mount())
    .catch(error=>{photoUi=null;console.warn('Fotoğraf arşivi yönetici arayüzü yüklenemedi:',error?.message||error);});
  }else photoUi.then(()=>root.DG_PHOTO_ARCHIVE_UI?.mount());
 }
 function render(bar,info,{bytes,count,quota,format}){
  const mb=bytes/1048576,ratio=mb/quota;
  bar.style.width=Math.min(100,ratio*100)+"%";
  bar.style.background=ratio>0.8?"var(--red)":(ratio>0.6?"var(--amber)":"var(--green)");
  info.textContent=format("{n} fotoğraf · {mb} MB / {q} MB",{n:count,mb:mb.toFixed(1),q:quota});
  mountOwnerArchiveControls();
 }
 function unavailable(info,message){if(info)info.textContent=message;mountOwnerArchiveControls();}
 root.DG_ADMIN_STORAGE_USAGE_UI=Object.freeze({render,unavailable});
})(window);
