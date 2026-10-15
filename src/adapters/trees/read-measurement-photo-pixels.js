"use strict";

/* Rasterize a loaded photo into the fixed-size pixel sample used by the gate. */
window.DG_READ_MEASUREMENT_PHOTO_PIXELS_ADAPTER={
  create({getDocument,getURL}){
    return Object.freeze({read(loaded,size){
      return window.DG_READ_MEASUREMENT_PHOTO_PIXELS_ADAPTER.read(loaded,size,{
        createCanvas:()=>getDocument().createElement("canvas"),
        revokeObjectURL:url=>getURL().revokeObjectURL(url)
      });
    }});
  },
  read(loaded,size,ports){
    const canvas=ports.createCanvas();canvas.width=size;canvas.height=size;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    context.drawImage(loaded.image,0,0,size,size);
    ports.revokeObjectURL(loaded.url);
    return context.getImageData(0,0,size,size).data;
  }
};
