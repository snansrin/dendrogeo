"use strict";

/* Read and validate the legacy measurement form without changing its rules. */
window.DG_VALIDATE_MEASUREMENT_SAVE_FORM={
  validate(ports){
    const form=typeof ports.read==="function"?ports.read():ports.form;
    for(const id of ["mProject","mPoint","mNo","mGroup","mSpecies","mDbh","mHeight"])ports.element(id).setAttribute("aria-invalid","false");
    const result=ports.validator.validateNewMeasurement({projectId:form.projectId,pointId:form.pointId,measurementNo:form.measurementNo,group:form.group,species:form.species,circumferenceCm:form.circumferenceCm,heightM:form.heightM});
    if(!result.valid){const issue=ports.errors[result.reason];return{valid:false,focusId:issue[0],message:ports.translate(issue[1]),reason:result.reason};}
    return{valid:true,form};
  }
};
