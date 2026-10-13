"use strict";
/* A footprint needs a spectral scan only when outside raster-water cells need review. */
(function(root){
  function requires({hasFootprint,parts=[],profile}){return !!hasFootprint&&parts.length>0&&!profile?.cells;}
  root.DG_REQUIRES_SURFACE_WATER_SCAN=Object.freeze({requires});
})(window);
