"use strict";
/* Select reviewed cells whose original raster class is water. */
(function(root){
  function select(parts=[]){return parts.filter(part=>(part.cell?.rasterClassKey||part.cell?.classKey)==="water"&&part.method==="review-cell");}
  root.DG_SELECT_SURFACE_WATER_OUTSIDE_PARTS=Object.freeze({select});
})(window);
