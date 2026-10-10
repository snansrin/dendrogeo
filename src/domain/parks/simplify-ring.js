"use strict";
/* Deterministically reduce a closed park ring to a bounded point count. */
(function(root){
  function simplifyRing(ring,max){
    if(!Array.isArray(ring)||ring.length<=max)return ring;
    const out=[];
    for(let k=0;k<max;k++)out.push(ring[Math.floor(k*ring.length/max)]);
    if(out.length<3)return ring;
    out.push(out[0]);
    return out;
  }
  root.DG_PARK_RING_DOMAIN=Object.freeze({simplifyRing});
})(window);
