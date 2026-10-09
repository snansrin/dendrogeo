"use strict";
/* DendroGeo · domain/surface/compare-source-class-areas.js
 * Area-level source agreement indicator. This is not a confidence score and
 * does not alter classes; it only compares group area totals already mapped.
 */
function dgCompareSurfaceSourceAreas(primary,secondary){
  const result={};
  for(const key of ["green","water","hard","bare","other"]){
    const primaryArea=primary.groupAreas?.[key]||0;
    const secondaryArea=secondary.groupAreas?.[key]||0;
    const total=primaryArea+secondaryArea;
    result[key]={
      primaryHa:primaryArea/10000,
      crossHa:secondaryArea/10000,
      agreementPct:total>0?Math.max(0,100*(1-Math.abs(primaryArea-secondaryArea)/total)):100
    };
  }
  return result;
}

window.DG_SURFACE_SOURCE_AGREEMENT=Object.freeze({compare:dgCompareSurfaceSourceAreas});
