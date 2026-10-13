"use strict";

/* Use mapped class area, then normalize across the evaluated strata. */
window.DG_BUILD_VALIDATION_STRATUM_WEIGHTS={
  build(groupAreasM2,assignedAreaM2,classes){
    const total=Number(assignedAreaM2)||0,weights={};let sum=0;
    for(const cls of classes){const area=Number(groupAreasM2&&groupAreasM2[cls])||0;weights[cls]=total>0?area/total:0;sum+=weights[cls];}
    if(sum>0)for(const cls of classes)weights[cls]=weights[cls]/sum;
    return weights;
  }
};
