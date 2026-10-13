"use strict";

/* Browser canvas compression; object URLs are always revoked after decoding. */
window.DG_COMPRESS_MEASUREMENT_PHOTO={
  async compress(file,ports){
    const{i,u}=await ports.loadImage(file);
    try{
      const maxSide=1024,scale=Math.min(1,maxSide/Math.max(i.width,i.height)),canvas=ports.document.createElement("canvas");
      canvas.width=i.width*scale;canvas.height=i.height*scale;
      canvas.getContext("2d").drawImage(i,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("image compression")),"image/jpeg",.7));
    }finally{ports.URL.revokeObjectURL(u);}
  }
};
