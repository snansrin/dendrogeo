"use strict";

/* Prepare annual confirmation without replacing evidence from the primary scan. */
window.DG_PREPARE_SENTINEL_ANNUAL_EVIDENCE={
  prepare({evidence,accumulator,year,mode,enabled,waterWindows}){
    if(!evidence){
      evidence={};
      for(const key of Object.keys(accumulator)){
        const entry=accumulator[key];
        evidence[key]={ndvi:entry.ndvis.slice(),mndwi:entry.mndwis.slice(),dates:new Set(entry.dates)};
      }
    }
    return {evidence,enabled,windows:enabled?waterWindows(year,mode):[]};
  }
};
