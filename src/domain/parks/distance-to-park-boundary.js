"use strict";
/* Return the minimum metric distance from a coordinate to any outer-ring edge. */
(function(root){
  function distance(lat,lon,geometry,distanceToSegment){
    if(!geometry||!Array.isArray(geometry.outer)||!geometry.outer.length)return null;
    let best=Infinity;
    for(const ring of geometry.outer){
      if(!Array.isArray(ring)||ring.length<2)continue;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const value=distanceToSegment(lat,lon,ring[j],ring[i]);
        if(value<best)best=value;
      }
    }
    return Number.isFinite(best)?best:null;
  }
  root.DG_PARK_BOUNDARY_DISTANCE=Object.freeze({distance});
})(window);
