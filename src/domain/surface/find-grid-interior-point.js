"use strict";

/* Find a safe interior point with bounded best-first subdivision. */
window.DG_FIND_GRID_INTERIOR_POINT={
  find(polygon,{bounds,pointDistance}){
    const box=bounds([polygon]);let best=null;
    const make=(x,y,half)=>{const distance=pointDistance([x,y],[polygon]);return{x,y,half,distance,max:distance+half*Math.SQRT2};};
    const queue=[make((box[0]+box[2])/2,(box[1]+box[3])/2,Math.max(box[2]-box[0],box[3]-box[1])/2)];
    for(let n=0;queue.length&&n<2048;n++){
      queue.sort((a,b)=>b.max-a.max);const candidate=queue.shift();if(!best||candidate.distance>best.distance)best=candidate;
      if(candidate.max-best.distance<=.15||candidate.half<=.075)continue;
      const half=candidate.half/2;for(const dx of[-half,half])for(const dy of[-half,half])queue.push(make(candidate.x+dx,candidate.y+dy,half));
    }
    return best?.distance>0?[best.x,best.y]:null;
  }
};
