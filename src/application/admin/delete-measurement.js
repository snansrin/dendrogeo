"use strict";
(function(root){
 async function execute(sb,id,removePhoto){
  const{data}=await root.DG_ADMIN_MODERATION_STORE.readPhoto(sb,id);
  if(data)await removePhoto(data.photo_url);
  return root.DG_ADMIN_MODERATION_STORE.deleteRecord(sb,id);
 }
 root.DG_ADMIN_DELETE_MEASUREMENT=Object.freeze({execute});
})(window);
