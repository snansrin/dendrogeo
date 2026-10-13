"use strict";

/* Normalize saved and legacy diameter-only rows into measurement form values. */
window.DG_BUILD_MEASUREMENT_EDIT_FORM={
  build(record,circumferenceFromDiameter){
    return{
      projectId:record.project_id,
      pointId:record.point_id,
      measurementNo:record.measurement_no||1,
      group:record.grp||"",
      species:record.species,
      circumference:record.girth_cm!=null?record.girth_cm:(typeof circumferenceFromDiameter==="function"?circumferenceFromDiameter(record.dbh_cm):record.dbh_cm),
      height:record.height_m
    };
  }
};
