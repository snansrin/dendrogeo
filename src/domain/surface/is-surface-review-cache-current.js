"use strict";

/* Keep a resolved overlay cache only while every identity-bearing input matches. */
window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT={
  matches(cached,{park,epsg,cells,features}){
    const sourceFeatures=features||[];
    return !!cached&&cached.park===park&&cached.epsg===epsg&&cached.cellCount===cells.length&&cached.cellFirst===cells[0]&&cached.features.length===sourceFeatures.length&&cached.features.every((feature,index)=>feature===sourceFeatures[index]);
  }
};
