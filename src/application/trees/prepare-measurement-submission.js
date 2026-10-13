"use strict";

/* Build the same measurement row and optional photo before any upload occurs. */
window.DG_PREPARE_MEASUREMENT_SUBMISSION={
  async prepare(validated,ports){
    const {form,gate,wasEdit}=validated;
    ports.rememberProject(form.projectId);
    const photo=await ports.preparePhoto(form);
    const calculation=ports.calculate(form);
    if(!calculation.valid)return{ok:false,form,gate,calculation,wasEdit};
    const record=ports.buildRecord({form,calculation,project:gate.project,photo,wasEdit});
    if(!record.client_id)record.client_id=ports.createClientId();
    if(!wasEdit){
      const geocode=await ports.reverseGeocode(ports.gps());
      Object.assign(record,ports.buildLocationFields({fix:ports.gps(),geocode}));
    }
    return{ok:true,form,gate,calculation,wasEdit,photo,record};
  }
};
