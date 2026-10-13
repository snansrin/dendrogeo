"use strict";

/* Count mapped/reference class pairs while keeping ambiguous labels in rows. */
window.DG_BUILD_VALIDATION_CONFUSION_MATRIX={
  build(samples,classes){
    const counts={};
    for(const mapClass of classes){counts[mapClass]={};for(const refClass of classes)counts[mapClass][refClass]=0;counts[mapClass].ambiguous=0;}
    let nTotal=0,nAmbiguous=0;
    for(const sample of(samples||[])){
      if(!sample||!sample.refClass||!sample.mapClass||!counts[sample.mapClass])continue;
      if(sample.refClass==="ambiguous"){counts[sample.mapClass].ambiguous++;nAmbiguous++;continue;}
      if(!counts[sample.mapClass][sample.refClass]&&counts[sample.mapClass][sample.refClass]!==0)continue;
      counts[sample.mapClass][sample.refClass]++;nTotal++;
    }
    const nRow={};for(const mapClass of classes)nRow[mapClass]=classes.reduce((sum,refClass)=>sum+counts[mapClass][refClass],0)+counts[mapClass].ambiguous;
    return{n:counts,nRow,nTotal,nAmbiguous,classes:classes.slice()};
  }
};
