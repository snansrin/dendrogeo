"use strict";

/* Olofsson area-adjusted overall accuracy and class-area uncertainty. */
window.DG_CALCULATE_VALIDATION_AREA_ESTIMATES={
  calculate(confusion,weights,proportions,assignedAreaM2,classes){
    let oa=0,seOaSquared=0;
    for(const cls of classes){
      const rowN=confusion.nRow[cls]||0;if(!rowN||!(weights[cls]>0))continue;
      oa+=weights[cls]*proportions[cls][cls];
      if(rowN>0)seOaSquared+=weights[cls]*weights[cls]*proportions[cls][cls]*(1-proportions[cls][cls])/rowN;
    }
    const seOa=Math.sqrt(Math.max(0,seOaSquared)),adjusted={},totalArea=Number(assignedAreaM2)||0;
    for(const refClass of classes){
      let proportion=0,seSquared=0;
      for(const mapClass of classes){
        const rowN=confusion.nRow[mapClass]||0;if(!(weights[mapClass]>0))continue;
        proportion+=weights[mapClass]*proportions[mapClass][refClass];
        if(rowN>1)seSquared+=weights[mapClass]*weights[mapClass]*proportions[mapClass][refClass]*(1-proportions[mapClass][refClass])/(rowN-1);
      }
      const se=totalArea>0?totalArea*Math.sqrt(Math.max(0,seSquared)):0;
      adjusted[refClass]={proportion:+proportion.toFixed(6),areaM2:+(totalArea*proportion).toFixed(2),areaHa:+(totalArea*proportion/10000).toFixed(4),seM2:+se.toFixed(2),ci95M2:+(1.96*se).toFixed(2)};
    }
    return{oa,seOa,adjusted};
  }
};
