/* Standard and verified GIS PNG grid renderers. */
(function(root){
 "use strict";
 function drawGrid(context,projector,cells){
  context.lineWidth=1;context.strokeStyle="#166534";
  for(const cell of cells||[]){
   if(![cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite))continue;
   context.strokeRect(projector.x(cell.w0),projector.y(cell.s1),
    projector.x(cell.w1)-projector.x(cell.w0),projector.y(cell.s0)-projector.y(cell.s1));
  }
 }
 function drawVerifiedGrid(context,projector,cells,color){
  for(const cell of cells||[]){
   if(Array.isArray(cell.geometry?.coordinates)){
    for(const polygon of cell.geometry.coordinates)for(const ring of polygon){
     context.beginPath();ring.forEach((point,index)=>{
      if(index)context.lineTo(projector.x(point[0]),projector.y(point[1]));
      else context.moveTo(projector.x(point[0]),projector.y(point[1]));
     });
     context.closePath();context.strokeStyle=color;context.lineWidth=1;context.stroke();
    }
   }else if([cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite)){
    context.strokeStyle=color;context.lineWidth=1;
    context.strokeRect(projector.x(cell.w0),projector.y(cell.s1),
     projector.x(cell.w1)-projector.x(cell.w0),projector.y(cell.s0)-projector.y(cell.s1));
   }
  }
 }
 root.DG_GIS_EXPORT_CANVAS_GRIDS=Object.freeze({drawGrid,drawVerifiedGrid});
})(window);
