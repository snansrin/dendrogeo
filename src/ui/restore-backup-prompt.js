"use strict";
(function(root){
 function build(backup,format){
  const counts=backup.counts||{};
  return format("{m} ölçüm · {p} proje · {w} waypoint · {r} talep içeriyor (dışa aktarma: {d}). Veri satırlarının geri yükleme SQL dosyası indirilsin mi? (Önce izole veritabanında doğrulanır; Storage dosyaları, yerel kuyruk ve hesaplar dahil değildir; kimlikler ve sahipler korunur, çakışan satırlar atlanır.)",
   {m:counts.measurements||0,p:counts.projects||0,w:counts.waypoints||0,r:counts.data_requests||0,d:String(backup.exported_at||"").slice(0,10)});
 }
 function status(message){
  const node=typeof document!=="undefined"?document.getElementById("dgPhotoArchiveStatus"):null;
  if(node)node.textContent=message;
 }
 function busy(value){
  const button=typeof document!=="undefined"?document.getElementById("dgPhotoArchiveDownload"):null;
  if(button)button.disabled=Boolean(value);
 }
 function mount(){
  if(typeof document==="undefined"||!document.querySelector||!document.createElement)return;
  const legacy=document.querySelector('[data-dg-backup-action="download"]');
  if(!legacy||document.getElementById("dgPhotoArchiveDownload"))return;
  const button=document.createElement("button");
  button.type="button";button.id="dgPhotoArchiveDownload";button.className="btn sm";
  button.style.marginTop="10px";button.style.marginLeft="8px";
  button.textContent="💾 Fotoğraflı Tam Veri Arşivi (ZIP)";
  button.addEventListener("click",()=>root.dgPhotoFullArchive?.());
  legacy.parentNode?.insertBefore(button,legacy);
  legacy.textContent="💾 JSON Yedeği (eski)";
  const picker=document.getElementById("dgRestoreFile");
  if(picker)picker.accept=".zip,application/zip,.json,application/json";
  const pick=document.querySelector('[data-dg-backup-action="pick-file"]');
  if(pick)pick.textContent="📥 Fotoğraflı Arşivden Geri Yükleme";
  const message=document.createElement("p");
  message.id="dgPhotoArchiveStatus";message.className="dg-meta";
  message.textContent="ZIP arşivi: 13 erişilebilir tablo + gerçek fotoğraflar + SHA-256 kontrolü + geri yükleme SQL'i. Veriler yalnız cihazınıza indirilir.";
  button.parentNode?.insertBefore(message,legacy);
 }
 root.DG_RESTORE_BACKUP_PROMPT=Object.freeze({build,status,busy,mount});
 if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);
  else mount();
 }
})(window);
