"use strict";
(function(root){
 function build(backup,format){
  const counts=backup.counts||{};
  return format("{m} ölçüm · {p} proje · {w} waypoint · {r} talep içeriyor (dışa aktarma: {d}). Veri satırlarının geri yükleme SQL dosyası indirilsin mi? (Önce izole veritabanında doğrulanır; Storage dosyaları, yerel kuyruk ve hesaplar dahil değildir; kimlikler ve sahipler korunur, çakışan satırlar atlanır.)",
   {m:counts.measurements||0,p:counts.projects||0,w:counts.waypoints||0,r:counts.data_requests||0,d:String(backup.exported_at||"").slice(0,10)});
 }
 function mountPhotoArchive(){
  if(typeof document==='undefined'||!document.getElementById)return;
  const admin=document.getElementById('v-admin');
  if(!admin)return;
  const download=admin.querySelector('[data-dg-backup-action="download"]');
  const restore=admin.querySelector('[data-dg-backup-action="pick-file"]');
  const input=admin.querySelector('[data-dg-backup-action="restore-file"]');
  if(!download||!restore||!input)return;
  download.textContent='💾 Fotoğraflı Tam Veri Arşivi (ZIP)';
  restore.textContent='📥 Fotoğraflı Arşiv / JSON Geri Yükleme';
  download.setAttribute('aria-label','Fotoğraflı Tam Veri Arşivi ZIP dosyası indir; yalnız hesap sahibi');
  restore.setAttribute('aria-label','Fotoğraflı veri arşivini veya eski JSON yedeğini doğrula');
  input.accept='.zip,application/zip,.json,application/json';
  const description=input.nextElementSibling;
  if(description?.classList?.contains('dg-meta')){
   description.textContent='Yalnız hesap sahibi (owner) yönetici: 13 erişilebilir tablo, gerçek fotoğraflar ve SHA-256 doğrulaması. ZIP geri yükleme dosya bütünlüğünü sınar, canlı kayıtları otomatik değiştirmez. Auth hesapları, cihaz taslakları ve veritabanı şeması ayrıca korunmalıdır.';
  }
  if(!document.getElementById('dgPhotoArchiveAdminStatus')){
   const status=document.createElement('p');
   status.id='dgPhotoArchiveAdminStatus';
   status.className='dg-meta';
   status.setAttribute('role','status');
   status.setAttribute('aria-live','polite');
   status.textContent='Fotoğraflı veri arşivi yalnız bu yönetici panelinden hazırlanır.';
   input.parentNode?.insertBefore(status,description||input.nextSibling);
  }
 }
 function status(message){
  const node=typeof document!=='undefined'?document.getElementById('dgPhotoArchiveAdminStatus'):null;
  if(node)node.textContent=message;
 }
 function busy(value){
  if(typeof document==='undefined')return;
  const admin=document.getElementById('v-admin');
  if(!admin)return;
  for(const action of ['download','pick-file']){
   const btn=admin.querySelector('[data-dg-backup-action="'+action+'"]');
   if(btn)btn.disabled=Boolean(value);
  }
 }
 root.DG_RESTORE_BACKUP_PROMPT=Object.freeze({build});
 root.DG_PHOTO_ARCHIVE_UI=Object.freeze({mount:mountPhotoArchive,status,busy});
 if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountPhotoArchive);
  else mountPhotoArchive();
 }
})(window);
