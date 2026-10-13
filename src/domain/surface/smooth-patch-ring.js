"use strict";
/* Saf tek halka görünüm akışı: yumuşatma ve alan koruma politikası enjekte edilir. */
(function(root){
function dgSmoothSurfacePatchRing(ring,iters,{smooth,area,centroid,scale}){
  const smoothed=smooth(ring,iters);
  return scale(smoothed,area(ring),area(smoothed),()=>centroid(smoothed));
}
root.DG_SMOOTH_SURFACE_PATCH_RING=Object.freeze({smooth:dgSmoothSurfacePatchRing});
})(typeof window!=="undefined"?window:globalThis);
