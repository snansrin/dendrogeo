"use strict";

/* Own identity caches used by surface-review geometry and resolution adapters. */
window.DG_SURFACE_REVIEW_CACHE_FACTORY={
  create(){
    const parts=new WeakMap(),masks=new WeakMap(),wgs=new WeakMap();
    return{
      parts,masks,wgs,
      seed(geometries,features,epsg,park,resolved,cells){
        parts.set(geometries,{features:features.slice(),epsg,park,parts:resolved,cellCount:cells?.length,cellFirst:cells?.[0]});
        for(const part of resolved)if(part.wgs)wgs.set(part.geom,{epsg,wgs:part.wgs});
      }
    };
  }
};
