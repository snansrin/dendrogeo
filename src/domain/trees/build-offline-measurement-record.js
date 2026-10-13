"use strict";

/* Add the existing offline queue metadata while retaining all row evidence. */
window.DG_BUILD_OFFLINE_MEASUREMENT_RECORD={
  build({record,photoBlob,photoFile,editId,clientId}){
    const offlineRecord={...record};
    if(photoBlob)offlineRecord.photoBlob=photoBlob;
    if(photoFile)offlineRecord.photo_file=photoFile;
    offlineRecord.client_id=clientId;
    if(editId)offlineRecord._editId=editId;
    return offlineRecord;
  }
};
