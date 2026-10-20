"use strict";
window.DG_BACKUP_PAGED_STORE={
 async load(client,table,orderCol){
  let out=[],from=0,step=1000;
  for(;;){
   let query=client.from(table).select("*").order(orderCol);
   if(table==="surface_reviews")query=query.order("owner");
   else if(orderCol!=="id")query=query.order("id");
   const {data,error}=await query.range(from,from+step-1);
   if(error)throw new Error(table+": "+error.message);
   out=out.concat(data||[]);
   if(!data||data.length<step)break;
   from+=step;
  }
  return out;
 },
 // Alternate paged reader for composite-key tables that do not have an "id".
 // Full rows are required for a restorable export; any denied table fails closed.
 async loadComplete(client,table,orderColumns){
  if(!Array.isArray(orderColumns)||!orderColumns.length)throw new Error(table+": sıra anahtarı eksik.");
  const out=[],step=500;
  for(let offset=0;;offset+=step){
   let query=client.from(table).select("*");
   for(const column of orderColumns)query=query.order(column);
   const {data,error}=await query.range(offset,offset+step-1);
   if(error)throw new Error(table+": "+error.message);
   if(!Array.isArray(data))throw new Error(table+": eksik sorgu yanıtı.");
   out.push(...data);
   if(out.length>100000)throw new Error(table+": 100.000 kayıt sınırı aşıldı; bu yedek tamamlanmadı.");
   if(data.length<step)break;
  }
  return out;
 },
 async archivePhotos(client,bucket,measurements,{maxBytes=536870912,onProgress=()=>{}}={}){
  if(bucket!=="dendro-photos")throw new Error("Arşiv yalnız dendro-photos için kullanılabilir.");
  const storage=client.storage.from(bucket),pageSize=100;
  const objects=[],seen=new Set(),folders=new Set([""]);
  const validateSegment=part=>{
   if(typeof part!=="string"||!part||part==="."||part===".."||part.includes("/")||part.includes("\\")||/[\u0000-\u001f\u007f]/.test(part))throw new Error("Geçersiz Storage dosya adı.");
   return part;
  };
  async function visit(prefix,depth){
   if(depth>12)throw new Error("Storage klasör derinliği sınırı aşıldı.");
   for(let offset=0;;offset+=pageSize){
    const {data,error}=await storage.list(prefix,{limit:pageSize,offset,sortBy:{column:"name",order:"asc"}});
    if(error)throw new Error("Fotoğraf listesi okunamadı: "+error.message);
    if(!Array.isArray(data))throw new Error("Storage listesi eksik yanıt verdi.");
    for(const entry of data){
     const name=validateSegment(entry.name),path=prefix?prefix+"/"+name:name;
     if(entry.id==null){
      if(folders.has(path))throw new Error("Storage klasörü tekrarlandı: "+path);
      folders.add(path);
      await visit(path,depth+1);
     }else{
      if(seen.has(path))throw new Error("Storage dosyası tekrarlandı: "+path);
      seen.add(path);
      const size=entry.metadata?.size,declaredBytes=size==null?null:Number(size);
      if(declaredBytes!==null&&(!Number.isSafeInteger(declaredBytes)||declaredBytes<0))throw new Error("Fotoğraf boyut bilgisi geçersiz: "+path);
      objects.push({path,declaredBytes,contentType:entry.metadata?.mimetype||"application/octet-stream"});
      if(objects.length>10000)throw new Error("Fotoğraf sayısı güvenli arşiv sınırını aştı.");
     }
    }
    if(data.length<pageSize)break;
   }
  }
  await visit("",0);
  const knownTotal=objects.reduce((sum,item)=>sum+(item.declaredBytes||0),0);
  if(knownTotal>maxBytes)throw new Error("Fotoğrafların boyutu güvenli ZIP sınırını aşıyor.");
  const referenced=new Set(),expectedOrigin=new URL(client.supabaseUrl||"https://invalid.invalid").origin;
  for(const measurement of measurements){
   const photoUrl=measurement?.photo_url;
   if(!photoUrl)continue;
   let path;
   try{
    const url=new URL(photoUrl);
    if(url.origin!==expectedOrigin)throw new Error("external");
    const marker="/storage/v1/object/public/"+bucket+"/";
    if(!url.pathname.startsWith(marker))throw new Error("not public");
    path=decodeURIComponent(url.pathname.slice(marker.length));
    if(!path||path.split("/").some(segment=>segment==="."||segment===".."||!segment))throw new Error("invalid path");
   }catch{throw new Error("Ölçüm "+String(measurement.id)+" için arşivlenemeyen fotoğraf bağlantısı.");}
   referenced.add(path);
  }
  for(const path of referenced)if(!seen.has(path))throw new Error("Ölçümde kayıtlı fotoğraf Storage listesinde bulunamadı: "+path);
  let downloadedBytes=0;const photos=[];
  for(const item of objects){
   if(item.declaredBytes!==null&&downloadedBytes+item.declaredBytes>maxBytes)throw new Error("Fotoğraflar ZIP sınırını aşıyor.");
   const {data,error}=await storage.download(item.path);
   if(error||!data||typeof data.arrayBuffer!=="function")throw new Error("Fotoğraf indirilemedi: "+item.path+(error?": "+error.message:""));
   if(item.declaredBytes!==null&&data.size!==item.declaredBytes)throw new Error("Fotoğraf boyutu uyuşmuyor: "+item.path);
   if(!Number.isSafeInteger(data.size)||data.size<0)throw new Error("Fotoğraf boyutu eksik: "+item.path);
   downloadedBytes+=data.size;
   if(downloadedBytes>maxBytes)throw new Error("Fotoğraflar ZIP sınırını aşıyor.");
   photos.push({path:item.path,blob:data,bytes:data.size,contentType:item.contentType});
   onProgress(photos.length,objects.length);
  }
  return {bucket,sourceOrigin:expectedOrigin,photos,downloadedBytes,referencedCount:referenced.size,listedCount:objects.length};
 }
};
