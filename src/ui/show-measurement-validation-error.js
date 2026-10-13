"use strict";

/* Mark and focus the invalid field before showing the existing error toast. */
window.DG_SHOW_MEASUREMENT_VALIDATION_ERROR={
  show({fieldId,message,element,notify}){
    const field=element(fieldId);if(field){field.setAttribute("aria-invalid","true");field.focus();}
    notify(message,"err");
  }
};
