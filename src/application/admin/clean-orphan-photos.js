"use strict";
(function(root){
 async function clean({ports,photoUrls,bucket="dendro-photos"}){
  const listing=await ports.listPhotoFiles(bucket,"",100);
  const urls=new Set((photoUrls||[]).map(row=>row.photo_url).filter(Boolean));
  let removed=0;
  for(const folder of (listing.data||[])){
   const children=await ports.listPhotoFiles(bucket,folder.name,1000);
   const orphans=[];
   for(const file of (children.data||[])){
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
