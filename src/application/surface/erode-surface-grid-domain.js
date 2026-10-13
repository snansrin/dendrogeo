"use strict";

/* Erode the candidate area by the requested metric clearance. */
window.DG_ERODE_SURFACE_GRID_DOMAIN={
  async erode(domain,clearance,{clip,schedule}){
    let safe=domain;
    const radius=(clearance+.15)/Math.cos(Math.PI/16);
    for(let i=0;i<16&&safe.length;i++){
      const dx=Math.cos(i*Math.PI/8)*radius,dy=Math.sin(i*Math.PI/8)*radius;
      safe=clip('intersection',safe,domain.map(polygon=>polygon.map(ring=>ring.map(point=>[Math.round((point[0]+dx)*1000)/1000,Math.round((point[1]+dy)*1000)/1000]))));
      if(i%4===3)await schedule();
    }
    return safe;
  }
};
