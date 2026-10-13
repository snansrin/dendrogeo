"use strict";

/* Apply polygon-clipping with millimetre normalization at every edge. */
window.DG_CLIP_GRID_GEOMETRY={
  clip(operation,geometries,{run,clean}){
    return clean(run(operation,...geometries.map(value=>clean(value))));
  }
};
