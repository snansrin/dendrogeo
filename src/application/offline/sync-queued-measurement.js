"use strict";

/* Sync one queue item while honoring account/network changes at each boundary. */
window.DG_SYNC_QUEUED_MEASUREMENT={
  async run({record,owner,isCurrent,client,findSaved,sameMeasurement,preparePayload,uploadPhoto,persist}){
    const data=record.data;
    const editId=data._editId||null;
    const baseline=data._editBaseline;
    if(editId&&(!baseline||String(baseline.id)!==String(editId)||String(baseline.owner)!==String(owner)))throw new Error("Düzenlemenin başlangıç kaydı yok; kayıt kuyrukta korundu. Güncel sunucu kaydını açıp değişiklikleri karşılaştırın.");
    const replayableEdit=editId&&data.client_id&&data.client_id!==baseline.client_id;
    let saved=(!editId||replayableEdit)?await findSaved(editId?{...baseline,...data}:data):null;
    if(saved&&editId&&String(saved.id)!==String(editId))throw new Error("Çevrimdışı düzenleme kimliği başka bir kayda ait; kuyruk korundu.");
    if(!isCurrent())return{stopped:true};
    if(!saved){
      const payload=preparePayload(data);
      if(data.photoBlob){
        payload.photo_url=await uploadPhoto({data,recordId:record.id});
        payload.photo_file=data.photo_file||`P${String(data.point_id).padStart(3,"0")}_M${data.measurement_no||1}.JPG`;
      }
      if(!isCurrent())return{stopped:true};
      const result=await persist({payload,editId,owner,baseline});
      if(result.error){
        // A duplicate point is not enough: prove it is this exact queued client record.
        if(!editId&&result.error.code==="23505")saved=await findSaved(data);
        if(!saved)throw new Error(result.error.message);
      }else{
        if(!result.data||!result.data.length)throw new Error(editId?"Kayıt başka bir oturumda değişmiş veya erişim kapanmış olabilir; çevrimdışı düzenleme kuyrukta korundu. Güncel kayıtla karşılaştırın.":"Sunucu kaydı doğrulanamadı; ölçüm kuyrukta tutuldu.");
        saved=result.data[0];
      }
    }
    return{saved};
  }
};
