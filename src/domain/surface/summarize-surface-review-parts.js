"use strict";

/* Reconcile measured cell totals with the resolved review-part areas. */
window.DG_SUMMARIZE_SURFACE_REVIEW_PARTS={
  summarize(base,parts){
    const areas={green:0,hard:0,building:0,water:0,bare:0,other:0,...base},seen=new Set();
    areas.water=(areas.water||0)+(areas.pool||0);delete areas.pool;
    for(const part of parts){
      if(!seen.has(part.key)){const original=part.cell.classKey||"other",key=original==="pool"?"water":original;areas[key]=(areas[key]||0)-Number(part.cell.areaM2||0);seen.add(part.key);}
      const key=part.type==="pool"?"water":part.type;
      areas[key]=(areas[key]||0)+part.areaM2;
    }
    for(const key of Object.keys(areas))if(Math.abs(areas[key])<1e-5)areas[key]=0;
    return areas;
  }
};
