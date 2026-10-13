"use strict";

/* Reconcile measured cell totals with the resolved review-part areas. */
window.DG_SUMMARIZE_SURFACE_REVIEW_PARTS={
  summarize(base,parts){
    const areas={green:0,hard:0,building:0,water:0,pool:0,bare:0,other:0,...base},seen=new Set();
    for(const part of parts){
      if(!seen.has(part.key)){const original=part.cell.classKey||"other";areas[original]=(areas[original]||0)-Number(part.cell.areaM2||0);seen.add(part.key);}
      areas[part.type]=(areas[part.type]||0)+part.areaM2;
    }
    for(const key of Object.keys(areas))if(Math.abs(areas[key])<1e-5)areas[key]=0;
    return areas;
  }
};
