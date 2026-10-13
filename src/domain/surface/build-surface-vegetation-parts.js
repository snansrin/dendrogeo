"use strict";

/* Pair eligible display tiers with prepared cell geometry for dissolving. */
window.DG_BUILD_SURFACE_VEGETATION_PARTS={
  build({cells,tiers,geometry,cellKey}){
    const parts=[];
    for(const cell of cells||[]){const tier=tiers.get(cellKey(cell)),geom=geometry?.[cellKey(cell)];if(tier&&geom?.length)parts.push({type:tier,geom,areaM2:Number(cell.areaM2)||0});}
    return parts;
  }
};
