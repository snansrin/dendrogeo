/* Canvas rendering helpers for GIS PNG exports. */
(function(root){
 "use strict";
 function drawRawPatches(context,projector,patches,classes){
  let painted=0;
  for(const patch of patches||[]){
   const rings=patch.rings||[];
   if(!rings.length)continue;
   context.beginPath();
   for(const ring of rings){
    ring.forEach((point,index)=>{
     const x=projector.x(point[1]),y=projector.y(point[0]);
     if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
    });
    context.closePath();
   }
   context.globalAlpha=.52;
   context.fillStyle=classes[patch.classKey||patch.group]?.color||"#94a3b8";
   context.fill("evenodd");
   context.globalAlpha=1;
   painted++;
  }
  return painted;
 }
 const drawLegend=root.DG_GIS_EXPORT_CANVAS_LEGEND.drawLegend;
 const {eachRing,drawLeaflet}=root.DG_GIS_EXPORT_CANVAS_LEAFLET;
 const {drawGrid,drawVerifiedGrid}=root.DG_GIS_EXPORT_CANVAS_GRIDS;
 const {drawWaypoints,drawVerifiedWaypoints}=root.DG_GIS_EXPORT_CANVAS_WAYPOINTS;
 root.DG_GIS_EXPORT_CANVAS=Object.freeze({eachRing,drawLeaflet,drawRawPatches,drawGrid,drawWaypoints,drawVerifiedGrid,drawVerifiedWaypoints,drawLegend});
})(window);
