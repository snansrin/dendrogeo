"use strict";
(function(root){
 async function execute(sb,id,removePhoto,store){
  const{data}=await store.readPhoto(sb,id);
  if(data)await removePhoto(data.photo_url);
  return store.deleteRecord(sb,id);
 }
 root.DG_ADMIN_DELETE_MEASUREMENT=Object.freeze({execute});
})(window);
