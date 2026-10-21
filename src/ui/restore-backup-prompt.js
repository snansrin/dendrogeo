"use strict";
(function(root){
 function build(backup,format){
  const counts=backup.counts||{};
  return format("{m} ölçüm · {p} proje · {w} ölçüm noktası · {r} talep içeriyor (dışa aktarma: {d}). Veri satırlarının geri yükleme SQL dosyası indirilsin mi? (Önce izole veritabanında doğrulanır; Storage dosyaları, yerel kuyruk ve hesaplar dahil değildir; kimlikler ve sahipler korunur, çakışan satırlar atlanır.)",
   {m:counts.measurements||0,p:counts.projects||0,w:counts.waypoints||0,r:counts.data_requests||0,d:String(backup.exported_at||"").slice(0,10)});
 }
 root.DG_RESTORE_BACKUP_PROMPT=Object.freeze({build});
})(window);
