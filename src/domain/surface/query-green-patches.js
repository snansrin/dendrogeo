"use strict";
/* Saf yüzey sorguları: uygulama durumuna erişmez; patch listesini alır. */
(function(root){
function dgSurfaceIsPointInGreenPatch(lat,lon,patches,pointInRings){
  if(!patches)return false;
  for(const patch of patches){
    if((patch.classKey||patch.group)!=="green")continue;
    if(pointInRings(lat,lon,patch.ringsRaw||patch.rings))return true;
  }
  return false;
}

function dgSurfaceHasGreenPatch(patches){
  return !!(patches&&patches.some(patch=>(patch.classKey||patch.group)==="green"));
}

root.DG_SURFACE_GREEN_PATCH_QUERY=Object.freeze({isPointInGreenPatch:dgSurfaceIsPointInGreenPatch,hasGreenPatch:dgSurfaceHasGreenPatch});
})(typeof window!=="undefined"?window:globalThis);
