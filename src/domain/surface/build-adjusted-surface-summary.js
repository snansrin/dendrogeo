"use strict";
/* Keep the raw raster baseline beside reviewed areas and correction counts. */
(function(root){
  function build({areas,rasterAreas,record}){if(!areas)return null;const count=Object.keys(record.corrections).length;return{raster:rasterAreas,corrected:areas,n:count,nCorrected:count,nConfirmed:0};}
  root.DG_BUILD_ADJUSTED_SURFACE_SUMMARY=Object.freeze({build});
})(window);
