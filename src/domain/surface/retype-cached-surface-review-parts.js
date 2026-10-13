"use strict";

/* Reapply live raster classes without rebuilding unchanged review geometries. */
window.DG_RETYPE_CACHED_SURFACE_REVIEW_PARTS={
  retype(parts,classFor,types){
    return parts.map(part=>{
      if(part.method!=="review-cell")return part;
      const type=classFor(part.cell)||"other";
      return{...part,type,group:types[type]?.group||"other"};
    });
  }
};
