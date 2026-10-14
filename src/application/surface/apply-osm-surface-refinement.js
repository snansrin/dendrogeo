"use strict";

/* Apply optional OSM water and road evidence to a detached raster result. */
(function(root){
  async function apply(source,{fetchWater,fetchRoads,refineWater,refineRoads,epsg,warn=()=>{}}){
    if(!source?.result)return source;
    const original=source.result,copy={...original,
      cells:(original.cells||[]).map(cell=>({...cell})),
      groupCounts:{...(original.groupCounts||{})},groupAreas:{...(original.groupAreas||{})},
      rawCounts:{...(original.rawCounts||{})},rawAreas:{...(original.rawAreas||{})}
    };
    let waterRefined=0,roadRefined=0;
    try{const rings=await fetchWater();waterRefined=Number(refineWater(copy,rings))||0;}catch(error){warn("OSM su kanıtı kullanılamadı",error);}
    try{const roads=await fetchRoads();roadRefined=Number(refineRoads(copy,roads,epsg))||0;}catch(error){warn("OSM yol kanıtı kullanılamadı",error);}
    return{...source,result:copy,waterRefined,roadRefined};
  }
  root.DG_APPLY_OSM_SURFACE_REFINEMENT=Object.freeze({apply});
})(window);
