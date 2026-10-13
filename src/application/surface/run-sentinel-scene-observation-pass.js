"use strict";

/* Read each selected scene, collect valid observations, and isolate scene errors. */
window.DG_RUN_SENTINEL_SCENE_OBSERVATION_PASS={
  async run({scenes,cells,token,bbox,bands,validClasses,accumulator,skipped},{loadBands,readWindows,indexCells,collect,project,indexFor,reflectance,signHref,openRaster,readBand,warn}){
    for(const scene of scenes){
      try{
        const images=await loadBands.load({scene,token,bands,signHref,openRaster});
        const reads=await readWindows.read({images,bands:["SCL","B03","B04","B08","B11"],bbox,readBand});
        const indices=indexCells.build({cells,bands:reads,project,indexFor});
        scene.usedCells=collect({cells,scl:reads.SCL,bands:reads,indices,validClasses,item:scene.item,datetime:scene.datetime,reflectance,accumulator});
      }catch(error){
        const reason=String(error&&error.message||error).slice(0,160);
        skipped.push({id:scene.id,reason});
        warn("DENDROGEO · Sentinel-2 sahnesi atlandı:",scene.id,reason.slice(0,120));
      }
    }
    return{scenes,skipped};
  }
};
