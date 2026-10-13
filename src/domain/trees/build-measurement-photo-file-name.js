"use strict";

/* Canonical field-photo name shared by online and offline measurement saves. */
window.DG_BUILD_MEASUREMENT_PHOTO_FILE_NAME={
  build({pointId,measurementNo}){
    return "P"+String(pointId).padStart(3,"0")+"_M"+measurementNo+".JPG";
  }
};
