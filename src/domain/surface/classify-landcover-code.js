"use strict";
/* DendroGeo · domain/surface/classify-landcover-code.js
 * Maps raw dataset codes to the report class model and applies each source's
 * nodata policy. Pure, deterministic rules with the current config injected.
 */
window.DG_SURFACE_CLASSIFICATION=(({
  codes,classes,esaGroups
})=>{
  function codeToClass(code){
    const n=Math.round(Number(code));
    if(n===3||n===6)return 11;
    if(n===0)return 0;
    return Object.prototype.hasOwnProperty.call(codes,n)?n:null;
  }

  function reportClassForCode(code){
    for(const cls of classes){
      if(cls.codes.includes(code))return cls.key;
    }
    return null;
  }

  function groupForCode(code,source){
    const n=Math.round(Number(code));
    if(!Number.isFinite(n))return null;
    if(source&&source.key==="primary")return esaGroups[n]||null;
    return reportClassForCode(codeToClass(n));
  }

  function isMasked(code,source){
    const n=Math.round(Number(code));
    if(!Number.isFinite(n))return true;
    if(source&&source.key==="primary")return n===0;
    return n===0||n===9||n===10;
  }

  return Object.freeze({codeToClass,reportClassForCode,groupForCode,isMasked});
})({codes:DG_LC_CODES,classes:DG_LC_CLASSES,esaGroups:DG_ESA_GROUP});
