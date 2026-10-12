"use strict";
(function(root){
 async function clean({storage,photoUrls,bucket="dendro-photos"}){
  const listing=await storage.from(bucket).list("",{limit:100});
  const urls=new Set((photoUrls||[]).map(row=>row.photo_url).filter(Boolean));
  let removed=0;
  for(const folder of (listing.data||[])){
   const children=await storage.from(bucket).list(folder.name,{limit:1000});
   const orphans=[];
   for(const file of (children.data||[])){
    const path=folder.name+"/"+file.name;
    const publicUrl=storage.from(bucket).getPublicUrl(path).data.publicUrl;
    if(!urls.has(publicUrl))orphans.push(path);
   }
   if(orphans.length){await storage.from(bucket).remove(orphans);removed+=orphans.length;}
  }
  return removed;
 }
 root.DG_CLEAN_ORPHAN_PHOTOS=Object.freeze({clean});
})(window);
