"use strict";
/* Saf halka koleksiyonu dönüşümü: her ham halkayı aynı görünüm politikasından geçirir. */
(function(root){
function dgBuildPatchDisplayRings(rings,smoothRing){return rings.map(ring=>smoothRing(ring,1));}
root.DG_SURFACE_PATCH_DISPLAY_RINGS=Object.freeze({build:dgBuildPatchDisplayRings});
})(typeof window!=="undefined"?window:globalThis);
