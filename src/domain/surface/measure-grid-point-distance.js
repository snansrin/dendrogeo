"use strict";

/* Signed Euclidean distance to polygon boundaries; holes remain outside. */
window.DG_MEASURE_GRID_POINT_DISTANCE={
  measure(point,geometry){
    let inside=false,minimum=Infinity;
    for(const polygon of geometry){
      let inPolygon=false;
      for(let ringIndex=0;ringIndex<polygon.length;ringIndex++){
        const ring=polygon[ringIndex];let hit=false;
        for(let j=0,k=ring.length-1;j<ring.length;k=j++){
          const a=ring[k],b=ring[j];
          if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
          const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
          minimum=Math.min(minimum,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy));
        }
        if(ringIndex===0)inPolygon=hit;else if(hit)inPolygon=false;
      }
      if(inPolygon)inside=true;
    }
    return inside?minimum:-minimum;
  }
};
