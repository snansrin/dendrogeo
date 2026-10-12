"use strict";
(function(root){
 async function read(storage,bucket="dendro-photos"){
  const listing=await storage.from(bucket).list("",{limit:100});
  let bytes=0,count=0;
  for(const folder of (listing.data||[])){
   const children=await storage.from(bucket).list(folder.name,{limit:1000});
   (children.data||[]).forEach(file=>{bytes+=(file.metadata&&file.metadata.size)||0;count++;});
  }
  return{bytes,count};
 }
 root.DG_READ_PHOTO_STORAGE_USAGE=Object.freeze({read});
})(window);
