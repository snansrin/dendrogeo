"use strict";
(function(root){
 async function read(ports,bucket="dendro-photos"){
  let bytes=0,count=0;
  const paths=[""];
  while(paths.length){
   const path=paths.shift(),limit=path?1000:100;
   for(let offset=0;;offset+=limit){
    const page=await ports.listPhotoFiles(bucket,path,limit,offset);
    for(const file of page){
     if(file.metadata==null&&file.id==null){paths.push(path?path+"/"+file.name:file.name);continue;}
     const size=Number(file.metadata?.size);
     if(!Number.isFinite(size)||size<0)throw new Error("Fotoğraf boyutu doğrulanamadı.");
     bytes+=size;count++;
    }
    if(page.length<limit)break;
   }
  }
  return{bytes,count};
 }
 root.DG_READ_PHOTO_STORAGE_USAGE=Object.freeze({read});
})(window);
