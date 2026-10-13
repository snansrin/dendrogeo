"use strict";

/* Clip overlays to the active park and reuse masks while their inputs stay stable. */
window.DG_PREPARE_SURFACE_REVIEW_FEATURE_MASKS={
  prepare(features,{park,epsg,cache,geometry,clip,bounds}){
    return features.map(feature=>{
      const old=cache.get(feature);
      if(old?.park===park&&old.epsg===epsg)return old.mask;
      const geom=clip("intersection",geometry(feature,epsg),park),mask={...feature,geom,bbox:bounds(geom)};
      cache.set(feature,{park,epsg,mask});
      return mask;
    });
  }
};
