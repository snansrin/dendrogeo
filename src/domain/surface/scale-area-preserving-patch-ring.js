"use strict";
/* Saf görünüm politikası: Chaikin sonrası halka alanı içe çekildiyse sınırlı
 * biçimde büyütür. Patch rapor alanı ve ham geometri bu karardan etkilenmez. */
(function(root){
function dgScaleAreaPreservingPatchRing(ring,sourceArea,smoothedArea,getCenter){
  const a0=Math.abs(sourceArea),a1=Math.abs(smoothedArea);
  if(!(a0>0)||!(a1>0))return ring;
  const factor=Math.sqrt(a0/a1);
  if(!Number.isFinite(factor)||factor<=1||factor>1.5)return ring;
  const center=getCenter();
  return ring.map(point=>[center[0]+(point[0]-center[0])*factor,center[1]+(point[1]-center[1])*factor]);
}
root.DG_SCALE_AREA_PRESERVING_PATCH_RING=Object.freeze({scale:dgScaleAreaPreservingPatchRing});
})(typeof window!=="undefined"?window:globalThis);
