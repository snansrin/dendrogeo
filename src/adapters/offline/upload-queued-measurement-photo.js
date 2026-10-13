"use strict";

/* Upload a queued image and return the same public URL stored by the legacy flow. */
window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO={
  async upload({client,data,recordId,now}){
    const path=`${data.owner}/${(now||Date.now)()}_${recordId}.jpg`;
    const result=await client.storage.from("dendro-photos").upload(path,data.photoBlob,{contentType:"image/jpeg"});
    if(result.error)throw new Error("Fotoğraf: "+result.error.message);
    return client.storage.from("dendro-photos").getPublicUrl(path).data.publicUrl;
  }
};
