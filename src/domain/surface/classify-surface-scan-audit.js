"use strict";

/* Summarize spectral evidence against the immutable baseline classes. */
window.DG_CLASSIFY_SURFACE_SCAN_AUDIT={
  build({cells,profile,classes,cellKey,spectralPredict}){
    if(!profile?.cells)return null;
    const transitions=new Map();let usable=0,matched=0,ambiguous=0,missing=0;
    for(const cell of cells||[]){
      const evidence=profile.cells[cellKey(cell)];if(!evidence){missing++;continue;}
      const prediction=spectralPredict(evidence,{green:50,water:50,hard:50,bare:50});
      if(prediction==="nodata"){missing++;continue;}if(!classes.includes(prediction)){ambiguous++;continue;}
      const rasterClass=cell.rasterClassKey||cell.classKey,original=classes.includes(rasterClass)?rasterClass:"other";
      usable++;if(original===prediction)matched++;
      const pair=original+"→"+prediction,entry=transitions.get(pair)||{from:original,to:prediction,cells:0,areaM2:0};entry.cells++;entry.areaM2+=Number(cell.areaM2)||0;transitions.set(pair,entry);
    }
    const scenes=(profile.scenes||[]).filter(scene=>Number(scene.usedCells)>0).sort((a,b)=>String(a.datetime).localeCompare(String(b.datetime)));
    return{total:(cells||[]).length,profiled:Number(profile.stats?.nProfiled)||0,usable,matched,ambiguous,missing,transitions:[...transitions.values()].filter(item=>item.from!==item.to).sort((a,b)=>b.areaM2-a.areaM2),scenes,skipped:(profile.skipped||[]).length,range:profile.range||null};
  }
};
