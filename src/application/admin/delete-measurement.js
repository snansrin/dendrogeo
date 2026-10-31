"use strict";
(function(root){
 async function execute(sb,id,removePhoto,store){
  const{data}=await store.readPhoto(sb,id);
  const result=await store.deleteRecord(sb,id);
  if(!result.error&&!result.data?.length)return{error:new Error("Kayıt silinemedi. Proje kilitli, izin değişmiş veya kayıt başka oturumda silinmiş olabilir.")};
  // Never remove the photo before the database has confirmed the row deletion.
  if(!result.error&&result.data?.length&&data?.photo_url){
    try{await removePhoto(data.photo_url);}catch(error){console.warn("Photo cleanup failed after measurement delete:",error);}
  }
  return result;
 }
 root.DG_ADMIN_DELETE_MEASUREMENT=Object.freeze({execute});
})(window);
