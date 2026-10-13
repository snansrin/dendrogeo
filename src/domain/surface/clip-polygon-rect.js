"use strict";
/* Sutherland–Hodgman clipping against an axis-aligned rectangle. */
(function(root){
  function clip(poly,rect){
    if(!Array.isArray(poly)||poly.length<3)return[];
    let out=poly.slice();
    const step=(inside,intersect)=>{if(!out.length)return;const input=out;out=[];let previous=input[input.length-1];for(const current of input){const currentInside=inside(current),previousInside=inside(previous);if(currentInside){if(!previousInside)out.push(intersect(previous,current));out.push(current);}else if(previousInside)out.push(intersect(previous,current));previous=current;}};
    step(p=>p.x>=rect.minX,(a,b)=>{const dx=b.x-a.x||1e-12,t=(rect.minX-a.x)/dx;return{x:rect.minX,y:a.y+(b.y-a.y)*t};});
    step(p=>p.x<=rect.maxX,(a,b)=>{const dx=b.x-a.x||1e-12,t=(rect.maxX-a.x)/dx;return{x:rect.maxX,y:a.y+(b.y-a.y)*t};});
    step(p=>p.y>=rect.minY,(a,b)=>{const dy=b.y-a.y||1e-12,t=(rect.minY-a.y)/dy;return{x:a.x+(b.x-a.x)*t,y:rect.minY};});
    step(p=>p.y<=rect.maxY,(a,b)=>{const dy=b.y-a.y||1e-12,t=(rect.maxY-a.y)/dy;return{x:a.x+(b.x-a.x)*t,y:rect.maxY};});
    return out;
  }
  root.DG_SURFACE_RECT_CLIP=Object.freeze({clip});
})(window);
