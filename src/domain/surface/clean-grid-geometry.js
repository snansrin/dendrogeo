"use strict";

/* Round UTM coordinates to millimetres and discard collapsed rings. */
window.DG_CLEAN_GRID_GEOMETRY={
  clean(geometry,{area}){
    if(typeof geometry?.[0]?.[0]?.[0]==="number")geometry=[geometry];
    const cleaned=[];
    for(const polygon of geometry||[]){
      const rings=[];
      for(let i=0;i<polygon.length;i++){
        const ring=[];
        for(const point of polygon[i]){const rounded=[Math.round(point[0]*1000)/1000,Math.round(point[1]*1000)/1000];if(!ring.length||rounded[0]!==ring.at(-1)[0]||rounded[1]!==ring.at(-1)[1])ring.push(rounded);}
        if(ring.length&&(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1]))ring.push([...ring[0]]);
        if(ring.length<4){if(i===0)break;continue;}rings.push(ring);
      }
      if(rings.length&&area([rings])>.000001)cleaned.push(rings);
    }
    return cleaned;
  }
};
