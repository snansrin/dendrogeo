"use strict";

/* Keep form, park, GPS and photo gates in their original order. */
window.DG_VALIDATE_MEASUREMENT_SUBMISSION={
  validate(input,ports){
    const form=input.form;
    const validation=ports.validateForm(form);
    if(!validation.valid)return{ok:false,reason:"form",validation};
    const gate=ports.resolveGates(input);
    if(gate.reason)return{ok:false,reason:gate.reason,project:gate.project};
    return{ok:true,form,gate,wasEdit:!!input.editId};
  }
};
