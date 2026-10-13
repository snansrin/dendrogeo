"use strict";

/* Add distinct-date annual confirmation and seasonal maxima to each profile cell. */
window.DG_MERGE_SENTINEL_ANNUAL_EVIDENCE={
  merge({out,evidence,waterMax,vegMax,confirmedExtreme,vegetationSummary}){
    for(const key of Object.keys(out)){
      const cell=out[key],annual=evidence[key];
      cell.ndviConfirmedYear=confirmedExtreme(annual?.ndvi||[]);
      cell.mndwiConfirmedYear=confirmedExtreme(annual?.mndwi||[]);
      cell.ndviMedianYear=vegetationSummary(annual).ndviMedianYear;
      cell.yearObs=annual?.dates.size||0;
      const water=waterMax[key],summerWater=Number.isFinite(cell.mndwiMax)?cell.mndwiMax:null;
      const maxWater=(water!==undefined&&summerWater!==null)?Math.max(water,summerWater):(water!==undefined?water:summerWater);
      if(maxWater!==null&&Number.isFinite(maxWater))cell.mndwiMaxYear=+maxWater.toFixed(4);
      const vegetation=vegMax[key],summerVegetation=Number.isFinite(cell.ndviMax)?cell.ndviMax:null;
      const maxVegetation=(vegetation!==undefined&&summerVegetation!==null)?Math.max(vegetation,summerVegetation):(vegetation!==undefined?vegetation:summerVegetation);
      if(maxVegetation!==null&&Number.isFinite(maxVegetation))cell.ndviMaxYear=+maxVegetation.toFixed(4);
    }
    return out;
  }
};
