"use strict";

/* Apply optional OSM water and road evidence to a detached raster result. */
(function(root){
  async function apply(source,{fetchWater,fetchRoads,refineWater,refineRoads,epsg,yieldTask,warn=()=>{}}){
    if(!source?.result)return source;
    const original=source.result,copy={...original,
      cells:(original.cells||[]).map(cell=>({...cell})),
      groupCounts:{...(original.groupCounts||{})},groupAreas:{...(original.groupAreas||{})},
      rawCounts:{...(original.rawCounts||{})},rawAreas:{...(original.rawAreas||{})}
    };
    async function refine(fn,evidence){
      if(typeof yieldTask!=="function"||!copy.cells.length||(Array.isArray(evidence)&&!evidence.length))return Number(fn(copy,evidence,epsg))||0;
      const cells=copy.cells;let changed=0;
      try{for(let i=0;i<cells.length;i+=32){copy.cells=cells.slice(i,i+32);changed+=Number(fn(copy,evidence,epsg))||0;await yieldTask();}}
      finally{copy.cells=cells;}
      return changed;
    }
    let waterRefined=0,roadRefined=0;
    try{const rings=await fetchWater();waterRefined=await refine(refineWater,rings);}catch(error){warn("OSM su kanıtı kullanılamadı",error);}
    try{const roads=await fetchRoads();roadRefined=await refine(refineRoads,roads);}catch(error){warn("OSM yol kanıtı kullanılamadı",error);}
    return{...source,result:copy,waterRefined,roadRefined};
  }
  root.DG_APPLY_OSM_SURFACE_REFINEMENT=Object.freeze({apply});
})(window);
