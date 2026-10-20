// Presentation only: mounts into the EXISTING admin panel; no stand-alone URL.
(function(root){
 function mount(){
  if(typeof document==='undefined'||!document.getElementById)return;
  const panel=document.getElementById('v-admin');
  if(!panel)return;
  const download=panel.querySelector('[data-dg-backup-action="download"]');
  const restore=panel.querySelector('[data-dg-backup-action="pick-file"]');
  const input=panel.querySelector('[data-dg-backup-action="restore-file"]');
  if(!download||!restore||!input)return;
  download.textContent='💾 Fotoğraflı Tam Veri Arşivi (ZIP)';
  restore.textContent='📥 Fotoğraflı Arşiv / JSON Geri Yükleme';
  download.setAttribute('aria-label','Fotoğraflı Tam Veri Arşivini ZIP olarak indir; yalnız hesap sahibi');
  restore.setAttribute('aria-label','Fotoğraflı arşivi veya eski JSON yedeğini doğrula');
  input.accept='.zip,application/zip,.json,application/json';
  const description=input.nextElementSibling;
  if(description?.classList?.contains('dg-meta'))
   description.textContent='Yalnız hesap sahibi (owner) yönetici: 13 erişilebilir tablo ve gerçek fotoğraflar SHA-256 ile doğrulanır. ZIP seçmek kayıtları otomatik değiştirmez. Auth hesapları, cihaz taslakları ve şema bu pakete dahil değildir.';
  if(!document.getElementById('dgPhotoArchiveAdminStatus')){
   const status=document.createElement('p');
   status.id='dgPhotoArchiveAdminStatus';
   status.className='dg-meta';
   status.setAttribute('role','status');
   status.setAttribute('aria-live','polite');
   status.textContent='Fotoğraflı Tam Veri Arşivi yalnız Ölçüm Yönetimi & Onay panelindedir.';
   input.parentNode?.insertBefore(status,description||input.nextSibling);
  }
 }
 function status(message){
  const element=typeof document!=='undefined'?document.getElementById('dgPhotoArchiveAdminStatus'):null;
  if(element)element.textContent=message;
 }
 function busy(value){
  if(typeof document==='undefined')return;
  const panel=document.getElementById('v-admin');
  if(!panel)return;
  for(const action of ['download','pick-file']){
   const node=panel.querySelector('[data-dg-backup-action="'+action+'"]');
   if(node)node.disabled=Boolean(value);
  }
 }
 root.DG_PHOTO_ARCHIVE_UI=Object.freeze({mount,status,busy});
 if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
  else mount();
 }
})(window);
