/* Isolated browser-only recovery archive. No access to the scientific engines,
 * no application shell mutations, and no server-side backup job. */
export const TABLES=Object.freeze([
 ['measurements','created_at',['id']],
 ['projects','id',[]],
 ['waypoints','id',[]],
 ['data_requests','id',[]],
 ['parks','id',[]],
 ['surface_reviews','park_id',['owner']],
 ['profiles','id',[]],
 ['report_requests','created_at',['id']],
 ['report_retractions','created_at',['id']],
 ['park_invites','created_at',['id']],
 ['park_collaborators','park_id',['user_id']],
 ['site_metric_daily','day',['event','page','source','device','country']],
 ['site_visits','id',[]]
]);
const PRIMARY_TABLES=['parks','projects','measurements','waypoints','data_requests','surface_reviews'];
const PHOTO_BUCKET='dendro-photos',PAGE_SIZE=100,MAX_ARCHIVE_PHOTOS=10000,MAX_PHOTO_BYTES=512*1024*1024;
const enc=new TextEncoder();

function fail(message){throw new Error(message);}

export async function collectRecords(client,onProgress=()=>{}){
 const out={};
 for(const [table,sort,secondary] of TABLES){
  let records=[];
  for(let offset=0;;offset+=1000){
   let query=client.from(table).select('*').order(sort);
   for(const col of secondary)query=query.order(col);
   const {data,error}=await query.range(offset,offset+999);
   if(error)fail(table+' tablosu okunamadı: '+error.message);
   if(!Array.isArray(data))fail(table+' için eksik veri yanıtı.');
   records.push(...data);
   if(data.length<1000)break;
  }
  out[table]=records;
  onProgress(table+' · '+records.length+' kayıt okundu');
 }
 return out;
}
function safePart(segment){
 if(typeof segment!=='string'||!segment||segment==='.'||segment==='..'||/[\\/\u0000-\u001f]/.test(segment))fail('Geçersiz Storage dosya yolu.');
 return segment;
}
function validatePath(path){
 return path.split('/').map(safePart).join('/');
}
function photoReference(url,bucket=PHOTO_BUCKET){
 if(!url)return null;
 let path;
 try{
  const pathname=new URL(url).pathname,needle='/'+bucket+'/',i=pathname.indexOf(needle);
  if(i<0)fail('Harici bağlantı');
  path=decodeURIComponent(pathname.slice(i+needle.length));
 }catch{fail('Yedeklenemeyen fotoğraf bağlantısı bulundu.');}
 return validatePath(path);
}

export async function collectPhotoObjects(client,measurements,onProgress=()=>{}){
 const storage=client.storage.from(PHOTO_BUCKET),objects=[],known=new Set(),folders=new Set(['']);
 async function traverse(prefix,depth){
  if(depth>12)fail('Fotoğraf klasör derinliği sınırı aşıldı.');
  for(let offset=0;;offset+=PAGE_SIZE){
   const {data,error}=await storage.list(prefix,{limit:PAGE_SIZE,offset,sortBy:{column:'name',order:'asc'}});
   if(error)fail('Fotoğraf dosya listesi okunamadı: '+error.message);
   if(!Array.isArray(data))fail('Fotoğraf listesi beklenmeyen veri döndürdü.');
   for(const item of data){
    const segment=safePart(item.name),path=prefix?prefix+'/'+segment:segment;
    if(item.id==null){
     if(folders.has(path))fail('Tekrar eden klasör: '+path);
     folders.add(path);await traverse(path,depth+1);
    }else{
     if(known.has(path))fail('Tekrar eden fotoğraf: '+path);
     known.add(path);
     const size=item.metadata?.size;
     objects.push({path,size:size==null?null:Number(size),contentType:item.metadata?.mimetype||'application/octet-stream'});
     if(objects.length>MAX_ARCHIVE_PHOTOS)fail('Fotoğraf sayısı tarayıcı arşivi için çok büyük.');
    }
   }
   if(data.length<PAGE_SIZE)break;
  }
 }
 await traverse('',0);
 const references=new Set();
 for(const row of measurements){
  if(row?.photo_url)references.add(photoReference(row.photo_url));
 }
 for(const ref of references)if(!known.has(ref))fail('Ölçüme bağlı fotoğraf Storage içinde eksik: '+ref);
 onProgress(objects.length+' fotoğraf bulundu; '+references.size+' bağlantı doğrulandı');
 return {storage,objects,referenceCount:references.size};
}

export async function downloadPhotos(inventory,onProgress=()=>{}){
 const photos=[];let bytes=0;
 const {storage,objects,referenceCount}=inventory;
 for(const obj of objects){
  if(obj.size!==null&&(!Number.isFinite(obj.size)||obj.size<0))fail('Geçersiz fotoğraf boyutu: '+obj.path);
  if(obj.size!==null&&bytes+obj.size>MAX_PHOTO_BYTES)fail('Fotoğraflar 512 MiB tarayıcı güvenlik sınırını aşıyor. Kısmi yedek oluşturulmadı.');
  const {data,error}=await storage.download(obj.path);
  if(error||!data||typeof data.arrayBuffer!=='function')fail('Fotoğraf indirilemedi: '+obj.path+(error?' · '+error.message:''));
  if(obj.size!==null&&data.size!==obj.size)fail('İndirilen fotoğraf boyutu uyuşmuyor: '+obj.path);
  bytes+=data.size;
  if(bytes>MAX_PHOTO_BYTES)fail('512 MiB sınırına ulaşıldı. Kısmi yedek oluşturulmadı.');
  photos.push({...obj,blob:data,bytes:data.size});
  if(photos.length===objects.length||photos.length%10===0)onProgress(photos.length+'/'+objects.length+' fotoğraf indirildi');
 }
 return {photos,bytes,referenceCount};
}

export function sqlRestore(records,exportedAt){
 const sql=[
  '-- DendroGeo veri satiri kurtarma taslagi',
  '-- Tarih: '+String(exportedAt).replace(/[\r\n]/g,' '),
  '-- ONEMLI: Once Auth kullanicilari, sema ve Storage dosyalarini izole bir test ortaminda kurun.',
  '-- SADECE alti birincil tabloyu geri yukler; diger JSON tablolari ayrica ele alinmalidir.',
  '-- Var olan satirlari degistirmez; ON CONFLICT DO NOTHING.',
  'BEGIN;'
 ];
 const val=value=>{
  if(value==null)return'NULL';
  if(typeof value==='number')return Number.isFinite(value)?String(value):'NULL';
  if(typeof value==='boolean')return value?'true':'false';
  const str=typeof value==='object'?JSON.stringify(value):String(value);
  return "'"+str.replace(/'/g,"''")+"'";
 };
 for(const table of PRIMARY_TABLES){
  for(const row of records[table]||[]){
   if(!row||typeof row!=='object'||Array.isArray(row))fail('Bozuk yedek satiri: '+table);
   const columns=Object.keys(row);
   if(!columns.length)continue;
   const names=columns.map(x=>'"'+x.replace(/"/g,'""')+'"').join(', ');
   sql.push('INSERT INTO public.'+table+' ('+names+') OVERRIDING SYSTEM VALUE VALUES ('+columns.map(x=>val(row[x])).join(', ')+') ON CONFLICT DO NOTHING;');
  }
 }
 sql.push('COMMIT;');
 return sql.join('\n')+'\n';
}

function crc32(bytes){
 let c=-1;
 for(const b of bytes){
  c^=b;
  for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);
 }
 return(c^-1)>>>0;
}
export function zipStored(entries,BlobClass=Blob){
 if(entries.length>65535)fail('ZIP dosya sayısı aşıldı.');
 let offset=0,centralSize=0;
 const parts=[],central=[],names=new Set();
 for(const entry of entries){
  const name=validatePath(entry.name);
  if(names.has(name))fail('ZIP dosyası tekrarlandı: '+name);
  names.add(name);
  const filename=enc.encode(name),content=entry.bytes;
  if(!(content instanceof Uint8Array)||content.byteLength>0xffffffff)fail('Geçersiz ZIP dosyası: '+name);
  const crc=crc32(content),size=content.byteLength,local=new Uint8Array(30+filename.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);
  lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);
  lv.setUint16(8,0,true);
  lv.setUint32(14,crc,true);lv.setUint32(18,size,true);lv.setUint32(22,size,true);
  lv.setUint16(26,filename.length,true);local.set(filename,30);
  parts.push(local,content);
  const directory=new Uint8Array(46+filename.length),dv=new DataView(directory.buffer);
  dv.setUint32(0,0x02014b50,true);
  dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x0800,true);
  dv.setUint32(16,crc,true);dv.setUint32(20,size,true);dv.setUint32(24,size,true);
  dv.setUint16(28,filename.length,true);dv.setUint32(42,offset,true);
  directory.set(filename,46);central.push(directory);
  offset+=local.length+size;centralSize+=directory.length;
 }
 if(offset+centralSize>0xffffffff)fail('ZIP 4 GB biçim sınırını aşıyor.');
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);
 ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
 ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 return new BlobClass([...parts,...central,end],{type:'application/zip'});
}

export async function assembleArchive(records,photoData,{cryptoImpl=globalThis.crypto,BlobClass=Blob,exportedBy=''}={}){
 if(!cryptoImpl?.subtle)fail('SHA-256 bütünlük denetimi bu tarayıcıda kullanılamıyor.');
 const exportedAt=new Date().toISOString(),counts={};
 for(const [name] of TABLES){
  if(!Array.isArray(records[name]))fail('Eksik tablo: '+name);
  counts[name]=records[name].length;
 }
 const backup={
  app:'DendroGeo',schema_version:'2.0.0',exported_at:exportedAt,exported_by:exportedBy,
  scope:{
   access:'current-session-rls',complete_system_backup:false,photo_file_bytes_included:true,
   excluded:['auth-user-credentials','database-schema-and-policies','local-offline-queue','device-validation-campaigns','git-publication-archives'],
   warning:'RLS izinleri nedeniyle tam Supabase sistem dökümü değildir. 13 public tablonun oturumdan okunabilen tüm satırlarını içerir.'
  },
  counts,...records,
  storage:{bucket:PHOTO_BUCKET,downloaded_photo_count:photoData.photos.length,referenced_photo_count:photoData.referenceCount,downloaded_photo_bytes:photoData.bytes,
   objects:photoData.photos.map(p=>({path:p.path,bytes:p.bytes,content_type:p.contentType}))}
 };
 const readme=[
  'DENDROGEO · FOTOGRAFLI VERI ARSIVI',
  'Tarih: '+exportedAt,
  'data/backup.json: 13 public tablodan mevcut oturumun RLS yetkisiyle okunabilen tum sutunlar ve satirlar.',
  'storage/dendro-photos/: Her fotoğrafın gerçek ikili dosyası; yalnız bağlantısı degil.',
  'integrity.json: Paketteki her dosyanin SHA-256 dogrulama özeti.',
  'restore/primary-tables.sql: Yalniz parks/projects/measurements/waypoints/data_requests/surface_reviews icin idempotent SQL.',
  'GERI YUKLEME: Önce izole bir ortamda şema, politikalar ve ilgili Auth sahiplerini hazırlayın.',
  'Fotoğrafları dendro-photos bucketina aynı yol ile yükleyin. Sonra SQL taslağını test ederek çalıştırın.',
  'Diger tablolari backup.json içinden ayrıca geri yuklemek gerekir. Bu ZIP otomatik tam sistem geri yuklemesi değildir.',
  'Dahil olmayanlar: Auth sifreleri, RLS semasi/politikalar, cihazdaki offline kuyruk, yerel kampanya verileri ve GitHub rapor yayin arsivleri.',
  'Arşiv kişisel kayıtlar ve fotoğraflar içerir. Güvenli yerde saklayın.',
  ''
 ].join('\n');
 const additions=[{name:'README.txt',bytes:enc.encode(readme)},
  {name:'data/backup.json',bytes:enc.encode(JSON.stringify(backup,null,2)+'\n')},
  {name:'restore/primary-tables.sql',bytes:enc.encode(sqlRestore(records,exportedAt))}];
 for(const photo of photoData.photos){
  const content=new Uint8Array(await photo.blob.arrayBuffer());
  if(content.byteLength!==photo.bytes)fail('Fotoğraf doğrulaması başarısız: '+photo.path);
  additions.push({name:'storage/'+PHOTO_BUCKET+'/'+photo.path,bytes:content});
 }
 const integrity=[];
 for(const entry of additions){
  const digest=await cryptoImpl.subtle.digest('SHA-256',entry.bytes);
  integrity.push({name:entry.name,bytes:entry.bytes.byteLength,sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')});
 }
 additions.push({name:'integrity.json',bytes:enc.encode(JSON.stringify({schema:'dendrogeo-integrity/1',exported_at:exportedAt,entries:integrity},null,2)+'\n')});
 const blob=zipStored(additions,BlobClass);
 return{blob,counts,photos:photoData.photos.length,bytes:blob.size,exportedAt};
}

export async function makeFullArchive(client,{onProgress=()=>{},exportedBy='',cryptoImpl=globalThis.crypto,BlobClass=Blob}={}){
 const records=await collectRecords(client,onProgress);
 const inventory=await collectPhotoObjects(client,records.measurements,onProgress);
 const photos=await downloadPhotos(inventory,onProgress);
 onProgress('SHA-256 ve ZIP bütünlüğü hazırlanıyor');
 return assembleArchive(records,photos,{cryptoImpl,BlobClass,exportedBy});
}
