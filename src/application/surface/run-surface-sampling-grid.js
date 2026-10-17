"use strict";

/* Coordinate grid validation, domain preparation, clearance and cell building. */
window.DG_RUN_SURFACE_SAMPLING_GRID={
  async run(data,{validate,prepare,erode,buildCells,operations,schedule}){
    const options=validate(data),prepared=prepare(data,options,operations);
    const empty=()=>({cells:[],epsg:options.epsg,size:options.size,clearance:options.clearance,areaM2:0});
    if(!prepared.domain.length)return empty();
    const safe=await erode(prepared.domain,options.clearance,{clip:operations.clip,schedule});
    if(!safe.length)return empty();
    const built=await buildCells({safe,clearanceGeometry:prepared.domain,constraints:prepared.constraints,park:prepared.park,origin:prepared.origin,global:prepared.global,size:options.size,clearance:options.clearance,epsg:options.epsg},operations);
    return{...built,epsg:options.epsg,size:options.size,clearance:options.clearance,areaM2:operations.area(safe)};
  }
};
