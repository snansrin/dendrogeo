/* Compose the clipped park layers for standard GIS PNG output. */
(function(root){
 "use strict";
 function draw({context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviPolys,parkRings,holes=[],classMap,canvasApi,getLandcover,getGridCells,getWaypoints,outline}){
  const pr=layout.projection,dict=classMap;
  ctx.save();ctx.beginPath();
  for(const ring of parkRings)outline(ctx,pr,ring);
  for(const ring of holes)outline(ctx,pr,ring);
  ctx.clip("evenodd");
  let count=0;
  if(opts.cover){
   const display=Array.isArray(sens?.displayPaths)&&!sens.rawView?sens.displayPaths:[];
   if(display.length){
    for(const item of display){
     if(canvasApi.drawLeaflet(ctx,pr,item.poly,Math.max(.28,(sens.opacity||65)/100)))count++;
    }
   }else{
    const last=getLandcover();
    count+=canvasApi.drawRawPatches(ctx,pr,last?.patches||last?.report?.patches||[],dict);
   }
  }
  if(ndvi){
   for(const layer of ndviPolys)canvasApi.drawLeaflet(ctx,pr,layer,Math.max(.28,(sens?.opacity||65)/100));
  }
  if(opts.grid&&getGridCells)canvasApi.drawGrid(ctx,pr,getGridCells()||[]);
  if(opts.wp&&getWaypoints)canvasApi.drawWaypoints(ctx,pr,getWaypoints()||[]);
  ctx.restore();
  ctx.strokeStyle="#166534";ctx.lineWidth=2;ctx.setLineDash([9,5]);
  for(const ring of parkRings){ctx.beginPath();outline(ctx,pr,ring);ctx.stroke();}
  ctx.setLineDash([]);
  return{count};
 }
 root.DG_GIS_EXPORT_STANDARD_LAYERS=Object.freeze({draw});
})(window);
