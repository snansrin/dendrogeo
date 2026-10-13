"use strict";
/* Water boundaries may supersede raster water only when explicitly reviewed or verified. */
(function(root){
  function hasExplicit(record){return !!(record?.features||[]).some(feature=>feature?.type==="water"&&feature?.method==="visual-boundary");}
  function hasVerified(record,validFeature){return record?.useObjects!==false&&typeof validFeature==="function"&&(record?.objectFeatures||[]).some(feature=>feature?.type==="water"&&feature?.method==="osm-boundary"&&feature?.osmId==="way/423602740"&&validFeature(feature));}
  function hasFootprint(record,validFeature){return hasExplicit(record)||hasVerified(record,validFeature);}
  root.DG_SURFACE_WATER_FOOTPRINT_POLICY=Object.freeze({hasExplicit,hasVerified,hasFootprint});
})(window);
