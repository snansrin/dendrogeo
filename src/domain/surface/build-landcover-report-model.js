"use strict";

/* Prepare class rows and QA values without coupling the report to HTML. */
window.DG_LANDCOVER_REPORT_MODEL={
  build({result,extra,last,parkAreaM2,classes}){
    const normalized=window.DG_LANDCOVER_REPORT_RESULT.normalize(result),source=extra||(result.agreement||result.patches?result:last)||{};
    const evidence={primaryYear:source.primaryYear!=null?source.primaryYear:source.year,primaryLabel:source.primaryLabel,primaryCitation:source.primaryCitation,crossCitation:source.crossCitation,agreement:source.agreement,crossError:source.crossError,patches:source.patches};
    const analysisArea=normalized.assignedAreaM2,order=["green","water","hard","bare","other"],patchesBy={};
    for(const patch of evidence.patches||[]){const key=patch.classKey||patch.group;(patchesBy[key]=patchesBy[key]||[]).push(patch);}
    const active=order.filter(key=>(normalized.groupAreas?.[key]||0)>0),max=active.length?Math.max(...active.map(key=>normalized.groupAreas[key])):1;
    const rows=active.map(key=>{
      const cls=classes.find(item=>item.key===key),area=normalized.groupAreas[key]||0,groupPatches=patchesBy[key];
      return{key,emoji:cls.emoji,label:cls.label,color:cls.color,area,count:normalized.groupCounts?.[key]||0,pct:analysisArea>0?area/analysisArea*100:0,width:max>0?Math.max(2,area/max*100):0,agreement:evidence.agreement?.[key],patchCount:groupPatches?.length||0,largestPatchHa:groupPatches?.length?Math.max(...groupPatches.map(patch=>patch.areaHa!=null?patch.areaHa:(patch.areaM2||0)/10000)):null};
    });
    const maskedPct=analysisArea>0?normalized.maskedAreaM2/analysisArea*100:0,areaDeltaPct=parkAreaM2>0?Math.abs(analysisArea-parkAreaM2)/parkAreaM2*100:0;
    return{result:normalized,evidence,analysisArea,rows,parkAreaM2,qa:{areaDeltaPct,passed:areaDeltaPct<=.5},maskedPct,coveragePct:analysisArea>0?normalized.classifiedAreaM2/analysisArea*100:0};
  }
};
