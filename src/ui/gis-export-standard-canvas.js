/* Standard GIS PNG composition; reads presentation inputs only. */
(function(root){
 "use strict";
 function draw({context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviTiers,ndviPolys,parkRings,holes=[],parkName,classMap,canvasApi,getLandcover,getGridCells,getWaypoints,vegetationColors,format:fmt,outline}){
  const {W,H,PAD,TOP,LEGEND,projection:pr}=layout;
  const dict=classMap;
  ctx.fillStyle="#f7f6f2";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#d4ded5";ctx.strokeRect(12,12,W-24,H-24);
  ctx.font="bold 25px system-ui,sans-serif";ctx.fillStyle="#14532d";ctx.fillText("DendroGeo · Doğrulanmış Harita",PAD,44);
  ctx.font="14px system-ui,sans-serif";ctx.fillStyle="#475569";
  ctx.fillText((parkName||"Park analizi")+(ndvi?" · Göreli NDVI açık":""),PAD,69);
  ctx.fillText("Katmanlar: "+(ndvi?"Park yüzeyi + göreli NDVI":"Park yüzeyi")+
   "  |  "+new Date().toLocaleString("tr-TR"),PAD,91);
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
  canvasApi.drawLegend(ctx,{width:W,height:H,pad:PAD,legend:LEGEND,ndvi,tiers:ndviTiers,
   classes:dict,vegetationColors,format:fmt});
  return {count};
 }
 root.DG_GIS_EXPORT_STANDARD_CANVAS={draw};
})(window);
