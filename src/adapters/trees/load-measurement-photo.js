"use strict";

/* Browser image decoding adapter; each object URL is released by its caller. */
window.DG_MEASUREMENT_PHOTO_IMAGE={
  load(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);const image=new Image();
      image.onload=()=>resolve({i:image,u:url});
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("image"));};
      image.src=url;
    });
  }
};
