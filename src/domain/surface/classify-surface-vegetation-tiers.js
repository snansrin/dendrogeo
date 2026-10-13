"use strict";

/* Park-relative NDVI display tiers; never modify the raster class or area. */
window.DG_CLASSIFY_SURFACE_VEGETATION_TIERS={
  build({cells,profile,cellKey,effectiveClass}){
    if(!profile)return{tiers:new Map(),count:0,eligible:0,cutoffs:null};
    const candidates=[];
    for(const cell of cells||[]){
      if(effectiveClass(cell)!=="green")continue;
      const evidence=profile[cellKey(cell)],value=evidence?.ndviMedianYear==null?NaN:Number(evidence.ndviMedianYear),observations=Number(evidence?.ndviObs??evidence?.yearObs??evidence?.obs??0);
      if(Number.isFinite(value)&&observations>=3)candidates.push({key:cellKey(cell),value});
    }
    candidates.sort((a,b)=>a.value-b.value||a.key.localeCompare(b.key));
    const tiers=new Map(),count=candidates.length;let cutoffs=null;
    if(count>=9){
      const quantile=q=>{const at=(count-1)*q,low=Math.floor(at),high=Math.ceil(at);return candidates[low].value+(candidates[high].value-candidates[low].value)*(at-low);};
      cutoffs=[quantile(1/3),quantile(2/3)];
      for(const item of candidates)tiers.set(item.key,item.value<=cutoffs[0]?"sparse":item.value<=cutoffs[1]?"moderate":"dense");
    }
    return{tiers,count,eligible:(cells||[]).filter(cell=>effectiveClass(cell)==="green").length,cutoffs};
  }
};
