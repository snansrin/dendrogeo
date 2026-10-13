"use strict";
/* Sutherland–Hodgman clipping against an arbitrary convex counter-clockwise polygon. */
(function(root){
  function ensureCcw(poly){let area=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];area+=p.x*q.y-q.x*p.y;}return area<0?poly.slice().reverse():poly;}
  function clip(poly,clipRaw){
    if(!Array.isArray(poly)||poly.length<3)return[];const clipPoly=ensureCcw(clipRaw);if(clipPoly.length<3)return[];let out=poly.slice();
    for(let i=0;i<clipPoly.length&&out.length;i++){
      const a=clipPoly[i],b=clipPoly[(i+1)%clipPoly.length],inside=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-9;
      const intersect=(p,q)=>{const x1=p.x,y1=p.y,x2=q.x,y2=q.y,x3=a.x,y3=a.y,x4=b.x,y4=b.y,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(!den)return{x:q.x,y:q.y};const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1)};};
      const input=out;out=[];let previous=input[input.length-1],previousInside=inside(previous);
      for(const current of input){const currentInside=inside(current);if(currentInside){if(!previousInside)out.push(intersect(previous,current));out.push(current);}else if(previousInside)out.push(intersect(previous,current));previous=current;previousInside=currentInside;}
    }
    return out;
  }
  root.DG_SURFACE_CONVEX_CLIP=Object.freeze({ensureCcw,clip});
})(window);
