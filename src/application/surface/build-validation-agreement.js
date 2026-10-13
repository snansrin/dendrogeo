"use strict";
/* Compare raster labels to spectral evidence and issue the validation gate. */
(function(root){
  function agreement(cells,spectralByCell,opts,{defaults,classes,predict}){
    const options=Object.assign({},defaults,opts||{}),sensitivity=options.sens||null,perClass={};for(const cls of classes)perClass[cls]={agree:0,disagree:0,ambiguous:0,nodata:0,edge:0,pct:null};let agreeCount=0,candidateCount=0;const flagged=[];
    for(const cell of (cells||[])){const cls=cell.classKey;if(!perClass[cls])continue;if(Number(cell.areaM2||0)<options.edgeAreaM2){perClass[cls].edge++;continue;}const evidence=spectralByCell&&spectralByCell[cell.row+":"+cell.col],prediction=evidence?predict(evidence,sensitivity):"nodata";if(prediction==="nodata"){perClass[cls].nodata++;continue;}if(prediction==="ambiguous"){perClass[cls].ambiguous++;continue;}candidateCount++;if(prediction===cls){agreeCount++;perClass[cls].agree++;}else{perClass[cls].disagree++;flagged.push({row:cell.row,col:cell.col,mapClass:cls,specClass:prediction,center:cell.center,quadWgs:cell.quadWgs});}}
    for(const cls of classes){const n=perClass[cls].agree+perClass[cls].disagree;perClass[cls].pct=n>0?+(100*perClass[cls].agree/n).toFixed(1):null;}
    return{perClass,overallPct:candidateCount>0?+(100*agreeCount/candidateCount).toFixed(1):null,nCandidates:candidateCount,flagged};
  }
  function gate(metrics,agreementResult,nLabeled,thresholds){
    const reasons=[],n=Number(nLabeled)||0,G=thresholds,oa=metrics?Number(metrics.oa):null,kappa=metrics&&metrics.kappa!==null?Number(metrics.kappa):null,waterUa=metrics&&metrics.perClass&&metrics.perClass.water?Number(metrics.perClass.water.ua):null,spectral=agreementResult&&agreementResult.overallPct!==null&&agreementResult.overallPct!==undefined?Number(agreementResult.overallPct):null;
    if(n<G.MIN_N)reasons.push("Etiketli nokta "+n+" < "+G.MIN_N+" — istatistiksel güç yetersiz.");
    if(oa!==null&&Number.isFinite(oa)){if(oa<G.OA_FAIL)reasons.push("Genel doğruluk %"+(oa*100).toFixed(1)+" < %"+(G.OA_FAIL*100)+" (kritik eşik).");else if(oa<G.OA_PASS)reasons.push("Genel doğruluk %"+(oa*100).toFixed(1)+" — %"+(G.OA_PASS*100)+" hedefinin altında.");}
    if(waterUa!==null&&Number.isFinite(waterUa)){if(waterUa<G.WATER_UA_FAIL)reasons.push("Su kullanıcı doğruluğu %"+(waterUa*100).toFixed(1)+" < %"+(G.WATER_UA_FAIL*100)+" (kritik).");else if(waterUa<G.WATER_UA_PASS)reasons.push("Su kullanıcı doğruluğu %"+(waterUa*100).toFixed(1)+" — %"+(G.WATER_UA_PASS*100)+" hedefinin altında.");}
    if(kappa!==null&&Number.isFinite(kappa)&&kappa<G.KAPPA_PASS)reasons.push("Kappa "+kappa.toFixed(2)+" < "+G.KAPPA_PASS.toFixed(2)+" (Landis & Koch 'substantial' altı).");
    if(spectral!==null&&Number.isFinite(spectral)&&spectral<G.SPEC_AGREE_PASS*100)reasons.push("Spektral uzlaşma %"+spectral.toFixed(1)+" < %"+(G.SPEC_AGREE_PASS*100)+".");
    const critical=(oa!==null&&oa<G.OA_FAIL)||(waterUa!==null&&waterUa<G.WATER_UA_FAIL),state=critical?"KRITIK":(reasons.length?"INCELEME":(n>=G.MIN_N?"GECERLI":"INCELEME")),label=state==="GECERLI"?"🟢 DOĞRULANDI":state==="KRITIK"?"🔴 KRİTİK":"🟡 İNCELEME";
    return{state,label,reasons};
  }
  root.DG_BUILD_VALIDATION_AGREEMENT=Object.freeze({agreement,gate});
})(window);
