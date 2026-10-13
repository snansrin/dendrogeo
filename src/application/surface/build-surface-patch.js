"use strict";
/* Tek ölçülmüş bileşeni servis DTO'suna dönüştürür; halka hatası eski gibi
 * yalnızca çizimi düşürür ve ham halkayı/ölçüm sonucunu korur. */
(function(root){
function dgBuildSurfacePatch(item,{extractRings,buildDisplayRings,warn}){
  const cells=item.cells;
  let rings=[],ringsRaw=[];
  try{
    ringsRaw=extractRings(cells);
    rings=buildDisplayRings(ringsRaw);
  }catch(error){
    warn(error);
  }
  return{classKey:cells[0].classKey,areaM2:item.areaM2,cells:cells.length,centroid:item.centroid,rings,ringsRaw};
}
root.DG_BUILD_SURFACE_PATCH=Object.freeze({build:dgBuildSurfacePatch});
})(typeof window!=="undefined"?window:globalThis);
