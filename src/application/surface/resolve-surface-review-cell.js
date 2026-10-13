"use strict";

/* Apply newest review masks first and allocate each cell's measured area by overlay. */
window.DG_RESOLVE_SURFACE_REVIEW_CELL={
  resolve(cell,geometry,masks,{area,overlap,clip,types,classFor}){
    const full=area(geometry),cellArea=Number(cell.areaM2)||0;
    if(!full||!cellArea)return[];
    const key=cell.row+":"+cell.col,bbox=overlap.bounds(geometry),parts=[];
    let remaining=geometry;
    for(let i=masks.length-1;i>=0&&remaining.length;i--){
      const mask=masks[i];
      if(!overlap.matches(bbox,mask.bbox))continue;
      const geom=clip("intersection",remaining,mask.geom),partArea=area(geom);
      if(partArea>0){parts.push({key,cell,type:mask.type,group:types[mask.type].group,geom,areaM2:cellArea*partArea/full,method:mask.method||"visual-boundary",ts:mask.ts});remaining=clip("difference",remaining,mask.geom);}
    }
    if(remaining.length){const type=classFor(cell)||cell.classKey||"other";parts.push({key,cell,type,group:types[type]?.group||"other",geom:remaining,areaM2:cellArea*area(remaining)/full,method:"review-cell"});}
    return parts;
  }
};
