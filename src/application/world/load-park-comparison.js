"use strict";

/* Select the primary, legacy-schema, or denied path for the park comparison. */
window.DG_LOAD_PARK_COMPARISON={
 async execute({read,resolve,onDenied,onSchemaMissing,loadLegacy,render}){
  const{data,error}=await read();
  const path=resolve(error);
  if(path==="denied"){onDenied(error);return{status:"denied"};}
  if(path==="legacy"){onSchemaMissing(error);await loadLegacy();return{status:"legacy"};}
  const rows=data||[];render(rows);return{status:"primary",rows};
 }
};
