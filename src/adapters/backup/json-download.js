"use strict";
window.DG_BACKUP_JSON_DOWNLOAD={
 download(browser,backup,name){
  const a=browser.document.createElement("a");
  a.href=browser.URL.createObjectURL(new browser.Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
  a.download=name;
  browser.document.body.appendChild(a);a.click();a.remove();
  browser.setTimeout(()=>browser.URL.revokeObjectURL(a.href),5000);
 }
,
 // ZIP STORE: pure browser code, no cloud upload and no third-party dependency.
 // Every entry gets CRC32 and SHA-256 so a recovery operator can verify it.
 async downloadComplete(browser,backup,storage,name,restoreSql){
  const encoder=new TextEncoder(),digest=browser.crypto?.subtle;
  if(!digest)throw new Error("Güvenli SHA-256 doğrulaması bulunamadı.");
  const photos=storage.photos||[],entries=[];
  const hashes=[];
  const bytes=text=>encoder.encode(text);
  const checksum=async data=>Array.from(new Uint8Array(await digest.digest("SHA-256",data))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const add=async(path,data)=>{
   if(entries.some(entry=>entry.path===path))throw new Error("ZIP içinde yinelenen dosya adı: "+path);
   if(!(data instanceof Uint8Array))throw new Error("ZIP dosyası ikili veriye dönüştürülemedi.");
   if(data.byteLength>0xffffffff)throw new Error("ZIP dosyası 4 GB sınırını aşıyor.");
   entries.push({path,data});
   hashes.push({path,bytes:data.byteLength,sha256:await checksum(data)});
  };
  const imageItems=[];
  for(const photo of photos){
   const path="storage/"+storage.bucket+"/"+photo.path;
   const data=new Uint8Array(await photo.blob.arrayBuffer());
   if(data.byteLength!==photo.bytes)throw new Error("Arşiv fotoğraf boyutu doğrulanamadı: "+photo.path);
   imageItems.push({path:photo.path,bytes:photo.bytes,content_type:photo.contentType||"application/octet-stream"});
   await add(path,data);
  }
  const readme=[
   "DendroGeo fotoğraflı veri arşivi",
   "=================================",
   "Tarih: "+backup.exported_at,
   "Kapsam: Oturumun Supabase RLS izinleriyle okuyabildiği kayıtlar ve dendro-photos bucket'ında listeleyebildiği gerçek dosyalar.",
   "Bütün dosyaları doğrulamak için integrity.json SHA-256 değerlerini kullanın.",
   "data/backup.json: Tam sütunlarıyla dışa aktarılmış erişilebilir public tablo kayıtları.",
   "storage/dendro-photos/: Gerçek fotoğraf dosyaları; URL veya küçük önizleme değil.",
   "restore/data_restore.sql: SADECE parks, projects, measurements, waypoints, data_requests, surface_reviews tabloları için SQL.",
   "Kurtarma: Önce boş/izole test projesinde hesap sahipliği ve şemayı hazırlayın.",
   "Fotoğrafları dendro-photos bucket'ına aynı yollarla yükleyin; sonra SQL'i test edin.",
   "SQL mevcut satırları değiştirmez (ON CONFLICT DO NOTHING). Kayıp Auth hesaplarını veya diğer tablolardaki satırları otomatik geri yüklemez.",
   "Ek JSON tabloları: profiles, report_requests, report_retractions, park_invites, park_collaborators, site_metric_daily, site_visits.",
   "Uyarı: Bu paket Supabase Auth şifrelerini, RLS şemasını, GitHub rapor yayın arşivlerini veya cihazın çevrimdışı taslaklarını içermez.",
   "Fotoğraf dosyaları ve kişisel kayıtlar içerir; yalnız güvenli yerel ortama kaydedin."
  ].join("\n")+"\n";
  const included={...backup,storage:{bucket:storage.bucket,downloaded_photo_files:imageItems,referenced_photo_count:storage.referencedCount,downloaded_photo_bytes:storage.downloadedBytes}};
  await add("README.txt",bytes(readme));
  await add("data/backup.json",bytes(JSON.stringify(included,null,2)+"\n"));
  await add("restore/data_restore.sql",bytes(restoreSql));
  await add("integrity.json",bytes(JSON.stringify({schema:"dendrogeo-archive-integrity/1",exported_at:backup.exported_at,entries:hashes},null,2)+"\n"));
  if(entries.length>65535)throw new Error("ZIP dosya sayısı sınırı aşıldı.");

  function crc32(data){
   let crc=-1;
   for(const value of data){
    crc^=value;
    for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
   }
   return(crc^-1)>>>0;
  }
  const parts=[],directory=[];let offset=0,directorySize=0;
  for(const {path,data} of entries){
   const fileName=bytes(path),size=data.byteLength,crc=crc32(data),local=new Uint8Array(30+fileName.length);
   const view=new DataView(local.buffer);
   view.setUint32(0,0x04034b50,true);
   view.setUint16(4,20,true);view.setUint16(6,0x0800,true);
   view.setUint16(8,0,true);view.setUint32(14,crc,true);
   view.setUint32(18,size,true);view.setUint32(22,size,true);
   view.setUint16(26,fileName.length,true);
   local.set(fileName,30);
   parts.push(local,data);
   const central=new Uint8Array(46+fileName.length),c=new DataView(central.buffer);
   c.setUint32(0,0x02014b50,true);
   c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
   c.setUint32(16,crc,true);
   c.setUint32(20,size,true);c.setUint32(24,size,true);
   c.setUint16(28,fileName.length,true);
   c.setUint32(42,offset,true);
   central.set(fileName,46);
   directory.push(central);directorySize+=central.length;
   offset+=local.length+size;
  }
  if(offset+directorySize>0xffffffff)throw new Error("ZIP toplam boyutu 4 GB sınırını aşıyor.");
  const trailer=new Uint8Array(22),end=new DataView(trailer.buffer);
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);
  end.setUint32(12,directorySize,true);end.setUint32(16,offset,true);
  const archive=new browser.Blob([...parts,...directory,trailer],{type:"application/zip"});
  const url=browser.URL.createObjectURL(archive),link=browser.document.createElement("a");
  try{
   link.href=url;link.download=name;browser.document.body.appendChild(link);link.click();link.remove();
  }finally{browser.setTimeout(()=>browser.URL.revokeObjectURL(url),60000);}
  return{files:entries.length,photos:photos.length,bytes:archive.size};
 }

};
