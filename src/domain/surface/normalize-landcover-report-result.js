"use strict";

/* Normalize the two established land-cover result shapes for report consumers. */
window.DG_LANDCOVER_REPORT_RESULT={
  normalize(result){
    if(result.groupAreas)return result;
    return{
      groupCounts:result.groupCounts||{},groupAreas:result.groupAreasM2||{},rawCounts:result.rawCounts||{},rawAreas:result.rawAreasM2||{},
      classifiedAreaM2:result.classifiedAreaM2||0,maskedAreaM2:result.maskedAreaM2||0,maskedCount:result.maskedCount||0,
      sourceCells:result.sourceCells||0,assignedAreaM2:result.rasterCoverageAreaM2||result.assignedAreaM2||0,cells:result.cells,runs:result.runs
    };
  }
};
