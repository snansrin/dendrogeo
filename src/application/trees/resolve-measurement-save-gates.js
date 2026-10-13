"use strict";

/* Decide whether a new or edited measurement can proceed past form gates. */
window.DG_RESOLVE_MEASUREMENT_SAVE_GATES={
  resolve({projectId,editId,projects,parkSchemaOk,gps,photoValid}){
    const project=(projects||[]).find(item=>item.id===projectId);
    if(parkSchemaOk&&!editId&&(!project||!project.park_id))return{allowed:false,reason:"park-required",project};
    if(!editId&&!gps)return{allowed:false,reason:"gps-required",project};
    if(!photoValid)return{allowed:false,reason:"photo-invalid",project};
    return{allowed:true,reason:null,project};
  }
};
