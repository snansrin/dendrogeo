"use strict";

/* Upload only when called by the post-geofence online save branch. */
window.DG_UPLOAD_MEASUREMENT_PHOTO={
  async upload({client,userId,blob,now=Date.now}){
    const path=userId+"/"+now()+".jpg";
    const{error}=await client.storage.from("dendro-photos").upload(path,blob,{contentType:"image/jpeg"});
    if(error)throw error;
    const publicUrl=client.storage.from("dendro-photos").getPublicUrl(path).data.publicUrl;
    return{path,publicUrl};
  }
};
