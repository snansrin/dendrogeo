"use strict";

/* Sync one queue item while honoring account/network changes at each boundary. */
window.DG_SYNC_QUEUED_MEASUREMENT={
  async run({record,owner,isCurrent,client,findSaved,sameMeasurement,preparePayload,uploadPhoto,persist}){
    const data=record.data;
    const editId=data._editId||null;
    let saved=!editId?await findSaved(data):null;
    if(!isCurrent())return{stopped:true};
    if(!saved){
      const payload=preparePayload(data);
      if(data.photoBlob){
        payload.photo_url=await uploadPhoto({data,recordId:record.id});
        payload.photo_file=data.photo_file||`P${String(data.point_id).padStart(3,"0")}_M${data.measurement_no||1}.JPG`;
      }
      if(!isCurrent())return{stopped:true};
      const result=await persist({payload,editId,owner});
      if(result.error){
        // A duplicate point is not enough: prove it is this exact queued client record.
        if(!editId&&result.error.code==="23505")saved=await findSaved(data);
        if(!saved)throw new Error(result.error.message);
      }else{
        if(!result.data||!result.data.length)throw new Error("Sunucu kaydı doğrulanamadı; ölçüm kuyrukta tutuldu.");
        saved=result.data[0];
      }
    }
    return{saved};
  }
};
