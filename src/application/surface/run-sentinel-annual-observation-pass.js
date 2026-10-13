"use strict";

/* Collect annual water/vegetation evidence while keeping failed dates optional. */
window.DG_RUN_SENTINEL_ANNUAL_OBSERVATION_PASS={
  async run({entries,cells,token,bbox,validClasses,evidence,waterMax,vegMax,waterScenes},{loadBands,readWindows,readAnnualWindows,indexCells,collect,project,indexFor,reflectance,signHref,openRaster,readBand,warn}){
    for(const entry of entries){
      const scene=entry.scene;
      try{
        const reads=await readAnnualWindows.read({scene,token,bbox,loadBands,readBands:readWindows,signHref,openRaster,readBand});
        if(!reads)continue;
        const indices=indexCells.build({cells,bands:reads,project,indexFor});
        const usedCells=collect({cells,reads,indices,validClasses,item:scene.item,datetime:scene.datetime,reflectance,evidence,waterMax,vegMax});
        waterScenes.push({id:scene.id,cloud:scene.cloud,datetime:scene.datetime,window:entry.window.label,usedCells});
      }catch(error){
        warn("DENDROGEO · Sentinel-2 su sahnesi atlandı:",scene.id,String(error&&error.message||error).slice(0,120));
      }
    }
    return waterScenes;
  }
};
