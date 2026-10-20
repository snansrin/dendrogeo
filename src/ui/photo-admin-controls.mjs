// Standalone presentation module, loaded ONLY after the existing Admin panel's
// storage summary renders. Never creates an independently addressable page.
(function(root){
 function mount(){
  if(typeof document==='undefined'||!document.getElementById||!document.createElement)return;
  const panel=document.getElementById('v-admin');
  if(!panel)return;
  // UI-only visibility guard. Access to real data is independently enforced
  // by Supabase RLS and makeOwnerArchive()/inspectOwnerArchive() getUser checks.
  // Admin may enter the panel but cannot see the owner-only ZIP control.
  if(typeof PROFILE==='undefined'||PROFILE?.role!=='owner'){
   document.getElementById('dgPhotoArchiveAdminDownload')?.remove?.();
   document.getElementById('dgPhotoArchiveAdminStatus')?.remove?.();
   return;
  }
  const legacy=panel.querySelector('[data-dg-backup-action="download"]');
  const restore=panel.querySelector('[data-dg-backup-action="pick-file"]');
  const input=panel.querySelector('[data-dg-backup-action="restore-file"]');
  if(!legacy||!restore||!input)return;
  // The existing JSON backup stays unchanged for backwards compatibility.
  // Add a separate owner-only photo archive control using existing theme
  // classes, font tokens and keyboard focus handling.
  if(!document.getElementById('dgPhotoArchiveAdminDownload')){
   const photo=document.createElement('button');
   photo.id='dgPhotoArchiveAdminDownload';
   photo.type='button';
   photo.className='btn sm';
   photo.textContent='💾 Fotoğraflı Tam Veri Arşivi (ZIP)';
   photo.setAttribute('aria-label','Fotoğraflı Tam Veri Arşivini indir; yalnız hesap sahibi yetkilidir');
   photo.addEventListener('click',()=>root.dgPhotoFullBackup?.());
   legacy.parentNode?.insertBefore(photo,legacy.nextSibling);
  }
  restore.textContent='📥 Fotoğraflı Arşiv / JSON Geri Yükleme';
  restore.setAttribute('aria-label','Fotoğraflı ZIP arşivi veya eski JSON yedeğini doğrula');
  input.accept='.zip,application/zip,.json,application/json';
  const description=input.nextElementSibling;
  if(description?.classList?.contains('dg-meta'))
   description.textContent='Fotoğraflı Tam Veri Arşivi yalnız hesap sahibi (owner) yetkisindedir: 13 erişilebilir tablo ve gerçek fotoğraflar SHA-256 ile doğrulanır. ZIP seçmek canlı kayıtları değiştirmez. Auth hesapları, cihaz taslakları ve şema bu pakete dahil değildir.';
  if(!document.getElementById('dgPhotoArchiveAdminStatus')){
   const status=document.createElement('p');
   status.id='dgPhotoArchiveAdminStatus';
   status.className='dg-meta';
   status.setAttribute('role','status');
   status.setAttribute('aria-live','polite');
   status.textContent='Fotoğraflı ZIP yalnız yönetici panelindedir; indirme hesap sahibi yetkisi ister.';
   input.parentNode?.insertBefore(status,description||input.nextSibling);
  }
 }
 function status(message){
  const node=typeof document!=='undefined'?document.getElementById('dgPhotoArchiveAdminStatus'):null;
  if(node)node.textContent=message;
 }
 function busy(value){
  if(typeof document==='undefined')return;
  const panel=document.getElementById('v-admin');
  if(!panel)return;
  for(const selector of ['#dgPhotoArchiveAdminDownload','[data-dg-backup-action="download"]','[data-dg-backup-action="pick-file"]']){
   const node=panel.querySelector(selector);
   if(node)node.disabled=Boolean(value);
  }
 }
 root.DG_PHOTO_ARCHIVE_UI=Object.freeze({mount,status,busy});
})(window);
