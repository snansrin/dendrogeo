"use strict";
/* Compose Olofsson accuracy calculations from focused domain modules. */
(function(root){
  function legacyConfusion(samples,classes){
    const counts={};for(const mapClass of classes){counts[mapClass]={};for(const refClass of classes)counts[mapClass][refClass]=0;counts[mapClass].ambiguous=0;}
    let nTotal=0,nAmbiguous=0;
    for(const sample of(samples||[])){if(!sample||!sample.refClass||!sample.mapClass)continue;if(!counts[sample.mapClass])continue;if(sample.refClass==="ambiguous"){counts[sample.mapClass].ambiguous++;nAmbiguous++;continue;}if(!counts[sample.mapClass][sample.refClass]&&counts[sample.mapClass][sample.refClass]!==0)continue;counts[sample.mapClass][sample.refClass]++;nTotal++;}
    const nRow={};for(const mapClass of classes)nRow[mapClass]=classes.reduce((sum,refClass)=>sum+counts[mapClass][refClass],0)+counts[mapClass].ambiguous;
    return{n:counts,nRow,nTotal,nAmbiguous,classes:classes.slice()};
  }
  function legacyWeights(groupAreasM2,assignedAreaM2,classes){const total=Number(assignedAreaM2)||0,weights={};let sum=0;for(const cls of classes){const area=Number(groupAreasM2&&groupAreasM2[cls])||0;weights[cls]=total>0?area/total:0;sum+=weights[cls];}if(sum>0)for(const cls of classes)weights[cls]=weights[cls]/sum;return weights;}
  function legacyMetrics(confusion,weights,assignedAreaM2,classes){
    const proportions={};for(const mapClass of classes){proportions[mapClass]={};const rowN=confusion.nRow[mapClass]||0;for(const refClass of classes)proportions[mapClass][refClass]=rowN>0?confusion.n[mapClass][refClass]/rowN:0;proportions[mapClass].ambiguous=rowN>0?confusion.n[mapClass].ambiguous/rowN:0;}
    let oa=0,seOaSquared=0;for(const cls of classes){const rowN=confusion.nRow[cls]||0;if(!rowN||!(weights[cls]>0))continue;oa+=weights[cls]*proportions[cls][cls];if(rowN>0)seOaSquared+=weights[cls]*weights[cls]*proportions[cls][cls]*(1-proportions[cls][cls])/rowN;}
    const seOa=Math.sqrt(Math.max(0,seOaSquared)),adjusted={},totalArea=Number(assignedAreaM2)||0;
    for(const refClass of classes){let proportion=0,seSquared=0;for(const mapClass of classes){const rowN=confusion.nRow[mapClass]||0;if(!(weights[mapClass]>0))continue;proportion+=weights[mapClass]*proportions[mapClass][refClass];if(rowN>1)seSquared+=weights[mapClass]*weights[mapClass]*proportions[mapClass][refClass]*(1-proportions[mapClass][refClass])/(rowN-1);}const se=totalArea>0?totalArea*Math.sqrt(Math.max(0,seSquared)):0;adjusted[refClass]={proportion:+proportion.toFixed(6),areaM2:+(totalArea*proportion).toFixed(2),areaHa:+(totalArea*proportion/10000).toFixed(4),seM2:+se.toFixed(2),ci95M2:+(1.96*se).toFixed(2)};}
    const perClass={};for(const cls of classes){const rowN=confusion.nRow[cls]||0,ua=rowN>0?proportions[cls][cls]:null,seUa=rowN>0?Math.sqrt(Math.max(0,proportions[cls][cls]*(1-proportions[cls][cls])/rowN)):null,colSum=adjusted[cls].proportion,pa=(rowN>0&&colSum>0)?weights[cls]*proportions[cls][cls]/colSum:null;perClass[cls]={n:rowN,correct:confusion.n[cls][cls],ua:ua===null?null:+ua.toFixed(4),uaCi95:seUa===null?null:+(1.96*seUa).toFixed(4),pa:pa===null?null:+pa.toFixed(4),adjustedAreaHa:adjusted[cls].areaHa,adjustedCi95Ha:+(adjusted[cls].ci95M2/10000).toFixed(4),weight:+(weights[cls]||0).toFixed(6)};}
    let pe=0;for(const cls of classes)pe+=(weights[cls]||0)*adjusted[cls].proportion;const kappa=pe<1?(oa-pe)/(1-pe):null;
    return{n:confusion.nTotal+confusion.nAmbiguous,nAmbiguous:confusion.nAmbiguous,oa:+oa.toFixed(4),oaCi95:+(1.96*seOa).toFixed(4),oaSe:+seOa.toFixed(4),kappa:kappa===null?null:+kappa.toFixed(4),pe:+pe.toFixed(4),perClass,adjusted,weights:Object.fromEntries(classes.map(cls=>[cls,+(weights[cls]||0).toFixed(6)])),method:"Olofsson et al. (2014), RSE 144:48-57 — stratified area-adjusted"};
  }
  const ready=()=>root.DG_BUILD_VALIDATION_CONFUSION_MATRIX&&root.DG_BUILD_VALIDATION_STRATUM_WEIGHTS&&root.DG_CALCULATE_VALIDATION_CLASS_PROPORTIONS&&root.DG_CALCULATE_VALIDATION_AREA_ESTIMATES&&root.DG_CALCULATE_VALIDATION_CLASS_ACCURACY;
  function confusion(samples,classes){return ready()?root.DG_BUILD_VALIDATION_CONFUSION_MATRIX.build(samples,classes):legacyConfusion(samples,classes);}
  function weights(areas,total,classes){return ready()?root.DG_BUILD_VALIDATION_STRATUM_WEIGHTS.build(areas,total,classes):legacyWeights(areas,total,classes);}
  function metrics(matrix,stratumWeights,totalArea,classes){
    if(!ready())return legacyMetrics(matrix,stratumWeights,totalArea,classes);
    const proportions=root.DG_CALCULATE_VALIDATION_CLASS_PROPORTIONS.calculate(matrix,classes),estimates=root.DG_CALCULATE_VALIDATION_AREA_ESTIMATES.calculate(matrix,stratumWeights,proportions,totalArea,classes),classAccuracy=root.DG_CALCULATE_VALIDATION_CLASS_ACCURACY.calculate(matrix,stratumWeights,proportions,estimates.adjusted,estimates.oa,classes);
    return{n:matrix.nTotal+matrix.nAmbiguous,nAmbiguous:matrix.nAmbiguous,oa:+estimates.oa.toFixed(4),oaCi95:+(1.96*estimates.seOa).toFixed(4),oaSe:+estimates.seOa.toFixed(4),kappa:classAccuracy.kappa===null?null:+classAccuracy.kappa.toFixed(4),pe:+classAccuracy.pe.toFixed(4),perClass:classAccuracy.perClass,adjusted:estimates.adjusted,weights:Object.fromEntries(classes.map(cls=>[cls,+(stratumWeights[cls]||0).toFixed(6)])),method:"Olofsson et al. (2014), RSE 144:48-57 — stratified area-adjusted"};
  }
  root.DG_VALIDATION_ACCURACY_METRICS=Object.freeze({confusion,weights,metrics});
})(window);
