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
 const QUOTA_BYTES=1000000000;
 function render(bar,info,{bytes,count,quotaBytes=QUOTA_BYTES,format}){
  const mb=bytes/1000000,quota=quotaBytes/1000000,ratio=bytes/quotaBytes;
  bar.style.width=Math.min(100,ratio*100)+"%";
  bar.style.background=ratio>=0.85?"var(--red)":(ratio>=0.7?"var(--amber)":"var(--green)");
  info.textContent=format("{n} fotoğraf · {mb} MB / {q} MB",{n:count,mb:mb.toFixed(1),q:quota});
  const warning=info.ownerDocument?.getElementById("storeWarning");
  if(warning){
   warning.hidden=ratio<0.7;
   warning.style.color=ratio>=0.85?"var(--red)":"var(--amber)";
   warning.textContent=ratio>=0.95?format("Fotoğraf alanı %{p} dolu. Yeni yüklemeler için çok az alan kaldı.",{p:Math.floor(ratio*100)}):ratio>=0.85?format("Fotoğraf alanı %{p} dolu. Depolama kapasitesini artırmayı planlayın.",{p:Math.floor(ratio*100)}):format("Fotoğraf alanı %{p} dolu. Kalan alanı takip edin.",{p:Math.floor(ratio*100)});
  }
  mountOwnerArchiveControls();
 }
 function unavailable(info,message){if(info){info.textContent=message;const warning=info.ownerDocument?.getElementById("storeWarning");if(warning)warning.hidden=true;}mountOwnerArchiveControls();}
 root.DG_ADMIN_STORAGE_USAGE_UI=Object.freeze({render,unavailable});
})(window);
