"use strict";

/* Keep offline queueing and online photo/row writes as separate established paths. */
window.DG_PERSIST_MEASUREMENT_SUBMISSION={
  async persist(draft,ports){
    if(!ports.isOnline()){
      const record=ports.buildOfflineRecord(draft);
      await ports.saveOffline(record);
      return{ok:true,mode:"offline"};
    }
    let photoUrl=null;
    if(draft.photo.blob)photoUrl=(await ports.uploadPhoto(draft.photo.blob)).publicUrl;
    if(photoUrl){draft.record.photo_url=photoUrl;draft.record.photo_file=draft.photo.fileName;}
    const result=await ports.persistRecord(draft.record,draft.wasEdit?ports.editId():null);
    if(result.error)return{ok:false,error:result.error};
    return{ok:true,mode:"online"};
  }
};
