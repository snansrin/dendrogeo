"use strict";
/* Classify water-raster cells outside a reviewed water footprint from local evidence. */
(function(root){
  function classify({cell,record,cells=[],cellKey,landPredict,editing}){
    const key=cellKey(cell),decision=record?.corrections?.[key],land=new Set(["green","hard","bare"]);
    if(decision&&land.has(decision.to)&&(decision.method==="visual-cell"||(!editing&&decision.method==="sensitivity")))return decision.to;
    const evidence=record?.profile?.cells?.[key],result=typeof landPredict==="function"?landPredict(evidence,{green:50,water:50,hard:50,bare:50}):"nodata";
    if(land.has(result))return result;
    // Mixed 10 m shore pixels inherit the nearest observed non-water class in this grid.
    const row=Number(cell.row),col=Number(cell.col);let best=null;
    for(const neighbor of cells){
      const dr=Number(neighbor.row)-row,dc=Number(neighbor.col)-col;if(!dr&&!dc)continue;
      const distance=Math.hypot(dr,dc);if(best&&distance>best.distance)continue;
      let cls=neighbor.rasterClassKey||neighbor.classKey;
      if(cls==="water"){
        const spectrum=record?.profile?.cells?.[cellKey(neighbor)],pred=typeof landPredict==="function"?landPredict(spectrum,{green:50,water:50,hard:50,bare:50}):"nodata";
        if(land.has(pred))cls=pred;
      }
      if(!land.has(cls))continue;
      if(!best||distance<best.distance)best={distance,weights:{green:0,hard:0,bare:0}};
      if(Math.abs(distance-best.distance)<1e-9)best.weights[cls]++;
    }
    if(!best)return"other";
    return["green","hard","bare"].sort((a,b)=>best.weights[b]-best.weights[a]||["green","hard","bare"].indexOf(a)-["green","hard","bare"].indexOf(b))[0];
  }
  root.DG_CLASSIFY_SURFACE_WATER_OUTSIDE_CELL=Object.freeze({classify});
})(window);
