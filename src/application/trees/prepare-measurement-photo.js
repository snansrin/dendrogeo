"use strict";

/* Prepare one photo for the existing offline queue or later online upload. */
window.DG_PREPARE_MEASUREMENT_PHOTO={
  async prepare({file,pointId,measurementNo,compress,buildFileName}){
    if(!file)return null;
    const blob=await compress(file);
    return{blob,fileName:buildFileName({pointId,measurementNo})};
  }
};
