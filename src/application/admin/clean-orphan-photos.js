"use strict";
(function(root){
 async function clean({ports,bucket="dendro-photos"}){
  const photoRows=await ports.loadMeasurementPhotoUrls();
  if(!Array.isArray(photoRows))throw new Error("Ölçüm fotoğraf bağlantıları doğrulanamadı.");
  const folders=await ports.listPhotoFiles(bucket,"",100);
  const urls=new Set(photoRows.map(row=>row.photo_url).filter(Boolean));
  let removed=0;
  for(const folder of folders){
   const children=await ports.listPhotoFiles(bucket,folder.name,1000);
   const orphans=[];
   for(const file of children){
    const path=folder.name+"/"+file.name;
    const publicUrl=ports.getPhotoPublicUrl(bucket,path);
    if(!urls.has(publicUrl))orphans.push(path);
   }
   if(orphans.length){await ports.removePhotoFiles(bucket,orphans);removed+=orphans.length;}
  }
  return removed;
 }
 root.DG_CLEAN_ORPHAN_PHOTOS=Object.freeze({clean});
})(window);
