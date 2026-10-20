// Owner-initiated archive only. This module is loaded from the existing
// protected admin panel after an explicit click. No automatic network work.
import '../../adapters/backup/photo-full-paged-store.mjs';
import '../../domain/backup/photo-full-snapshot.mjs';
import '../../domain/backup/photo-full-sql-value.mjs';
import '../../domain/backup/photo-full-restore-sql.mjs';
import '../../adapters/backup/photo-full-zip.mjs';

const tablePlan=Object.freeze([
 ['measurements',['created_at','id']],
 ['projects',['id']],
 ['waypoints',['id']],
 ['data_requests',['id']],
 ['parks',['id']],
 ['surface_reviews',['park_id','owner']],
 ['profiles',['id']],
 ['report_requests',['id']],
 ['report_retractions',['id']],
 ['park_invites',['id']],
 ['park_collaborators',['park_id','user_id']],
 ['site_metric_daily',['day','event','page','source','device','country']],
 ['site_visits',['id']]
]);

export async function verifyOwner(client){
 if(!client?.auth?.getUser)throw Error('Supabase kimlik doğrulaması kullanılamıyor.');
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user?.id)throw Error('Hesabınız doğrulanamadı; yeniden giriş yapın.');
 const profile=await client.from('profiles').select('role,full_name').eq('id',data.user.id).single();
 if(profile.error||profile.data?.role!=='owner')
  throw Error('Fotoğraflı tam arşive yalnız DendroGeo sahip (owner) hesabı erişebilir.');
 return profile.data;
}

export async function makeOwnerArchive(client,{progress=()=>{},now=()=>new Date().toISOString()}={}){
 const profile=await verifyOwner(client);
 const records={};
 for(let i=0;i<tablePlan.length;i++){
  const [table,cols]=tablePlan[i];
  progress('Tablolar okunuyor '+(i+1)+'/13: '+table);
  records[table]=await window.DG_PHOTO_ARCHIVE_PAGED_STORE.loadComplete(client,table,cols);
 }
 progress('Fotoğraf dosyaları doğrulanıyor…');
 const storage=await window.DG_PHOTO_ARCHIVE_PAGED_STORE.archivePhotos(client,'dendro-photos',records.measurements,{
  onProgress:(completed,total)=>progress('Fotoğraflar: '+completed+'/'+total)
 });
 const exportedAt=now();
 const snapshot=window.DG_PHOTO_ARCHIVE_SNAPSHOT.buildComplete({...records,requests:records.data_requests},{
  exportedAt,exportedBy:profile.full_name||''
 });
 const built=window.DG_PHOTO_ARCHIVE_RESTORE_SQL.buildComplete(snapshot,window.DG_PHOTO_ARCHIVE_SQL_VALUE.serialize);
 if(built.tables!==13)throw Error('13 tablo kurtarma SQL’i oluşturulamadı.');
 progress('ZIP ve SHA-256 bütünlüğü oluşturuluyor…');
 const filename='dendrogeo_fotografli_tam_veri_arsivi_'+exportedAt.slice(0,10)+'.zip';
 const result=await window.DG_PHOTO_ARCHIVE_ZIP.downloadComplete(window,snapshot,storage,filename,built.sql,{deferDownload:true});
 // Unlike the old writer, verify the completed ZIP BEFORE triggering a save.
 const checked=await window.DG_PHOTO_ARCHIVE_ZIP.readComplete(window,result.archive);
 if(checked.restoreSql!==built.sql||checked.photos.length!==storage.photos.length||
     checked.backup.counts.measurements!==records.measurements.length||
     checked.backup.storage.downloaded_photo_bytes!==storage.downloadedBytes)
   throw Error('ZIP arşivinin bütünlük doğrulaması başarısız.');
 return{blob:result.archive,filename,counts:snapshot.counts,photos:checked.photos.length,files:result.files,bytes:result.bytes,exportedAt};
}

export async function inspectOwnerArchive(client,file){
 await verifyOwner(client);
 const checked=await window.DG_PHOTO_ARCHIVE_ZIP.readComplete(window,file);
 const built=window.DG_PHOTO_ARCHIVE_RESTORE_SQL.buildComplete(checked.backup,window.DG_PHOTO_ARCHIVE_SQL_VALUE.serialize);
 if(built.sql!==checked.restoreSql)throw Error('Arşiv SQL dosyası veri kayıtlarıyla eşleşmiyor.');
 if(built.tables!==13)throw Error('Arşivde 13 tablo doğrulanamadı.');
 return{sql:built.sql,measurements:checked.backup.counts.measurements,photos:checked.photos.length,rows:built.count};
}
