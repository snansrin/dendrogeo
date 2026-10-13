"use strict";

/* Produce user/producer accuracy and weighted kappa from adjusted estimates. */
window.DG_CALCULATE_VALIDATION_CLASS_ACCURACY={
  calculate(confusion,weights,proportions,adjusted,oa,classes){
    const perClass={};
    for(const cls of classes){
      const rowN=confusion.nRow[cls]||0,ua=rowN>0?proportions[cls][cls]:null;
      const seUa=rowN>0?Math.sqrt(Math.max(0,proportions[cls][cls]*(1-proportions[cls][cls])/rowN)):null;
      const columnSum=adjusted[cls].proportion,pa=(rowN>0&&columnSum>0)?weights[cls]*proportions[cls][cls]/columnSum:null;
      perClass[cls]={n:rowN,correct:confusion.n[cls][cls],ua:ua===null?null:+ua.toFixed(4),uaCi95:seUa===null?null:+(1.96*seUa).toFixed(4),pa:pa===null?null:+pa.toFixed(4),adjustedAreaHa:adjusted[cls].areaHa,adjustedCi95Ha:+(adjusted[cls].ci95M2/10000).toFixed(4),weight:+(weights[cls]||0).toFixed(6)};
    }
    let pe=0;for(const cls of classes)pe+=(weights[cls]||0)*adjusted[cls].proportion;
    return{perClass,pe,kappa:pe<1?(oa-pe)/(1-pe):null};
  }
};
