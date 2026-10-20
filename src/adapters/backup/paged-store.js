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
 }
,
 async archivePhotos(client,bucket,measurements,{maxBytes=536870912}={}){
  const storage=client.storage.from(bucket),pageSize=100;
  const objects=[],seen=new Set(),folders=new Set([""]);
  const validateSegment=(part)=>{
   if(!part||part==="."||part===".."||part.includes("/")||part.includes("\\")||/[\\u0000-\\u001f]/.test(part))throw new Error("Geçersiz Storage dosya adı.");
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
      folders.add(path);await visit(path,depth+1);
     }else{
      if(seen.has(path))throw new Error("Storage dosyası tekrarlandı: "+path);
      seen.add(path);
      const declaredBytes=Number(entry.metadata?.size);
      objects.push({path,declaredBytes:Number.isFinite(declaredBytes)&&entry.metadata?.size!=null?declaredBytes:null,contentType:entry.metadata?.mimetype||"application/octet-stream"});
      if(objects.length>10000)throw new Error("Fotoğraf sayısı güvenli arşiv sınırını aştı.");
     }
    }
    if(data.length<pageSize)break;
   }
  }
  await visit("",0);
  const referenced=new Set();
  for(const measurement of measurements){
   const url=measurement?.photo_url;
   if(!url)continue;
   let path;
   try{
    const pathname=new URL(url).pathname,marker="/"+bucket+"/",at=pathname.indexOf(marker);
    if(at<0)throw new Error("not bucket");
    path=decodeURIComponent(pathname.slice(at+marker.length));
   }catch{throw new Error("Ölçüm "+String(measurement.id)+" için arşivlenemeyen harici fotoğraf bağlantısı.");}
   referenced.add(path);
  }
  for(const path of referenced)if(!seen.has(path))throw new Error("Ölçümde kayıtlı fotoğraf Storage listesinde bulunamadı: "+path);
  // Sequential reads deliberately avoid flooding the Free Plan's egress.
  let downloadedBytes=0;const photos=[];
  for(const item of objects){
   if(item.declaredBytes!==null&&item.declaredBytes>=0&&downloadedBytes+item.declaredBytes>maxBytes)throw new Error("Fotoğraflar güvenli ZIP boyut sınırını aşıyor.");
   const {data,error}=await storage.download(item.path);
   if(error||!data||typeof data.arrayBuffer!=="function")throw new Error("Fotoğraf indirilemedi: "+item.path+(error?": "+error.message:""));
   const blob=data;
   if(item.declaredBytes!==null&&blob.size!==item.declaredBytes)throw new Error("Fotoğraf boyutu uyuşmuyor: "+item.path);
   downloadedBytes+=blob.size;
   if(downloadedBytes>maxBytes)throw new Error("Fotoğraflar güvenli ZIP boyut sınırını aşıyor.");
   photos.push({path:item.path,blob,bytes:blob.size,contentType:item.contentType});
  }
  return {bucket,photos,downloadedBytes,referencedCount:referenced.size};
 }

};
