"use strict";
/* Patch tespit use-case'i: bileşenleri grupla, mevcut eşik/metrikleri uygula,
 * her sonucu aynı DTO oluşturucusundan geçir ve sıralamayı koru. */
(function(root){
function dgDetectSurfacePatches(cells,minHa,{groupCells,summarizeComponents,buildPatch}){
  const measured=summarizeComponents(groupCells(cells),minHa);
  return measured.map(buildPatch);
}
root.DG_SURFACE_PATCH_DETECTOR=Object.freeze({detect:dgDetectSurfacePatches});
})(typeof window!=="undefined"?window:globalThis);
