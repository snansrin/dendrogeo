/* Raw surface patch rings rendered on standard GIS PNG exports. */
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
 root.DG_GIS_EXPORT_CANVAS_PATCHES=Object.freeze({drawRawPatches});
})(window);
