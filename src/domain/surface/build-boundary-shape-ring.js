"use strict";
/* Shapes are measured in the campaign UTM projection, never screen pixels. */
(function(root){
 function build({shape,first,last,forward,inverse}){
  if(!first||!last)return [];
  const a=forward(first[1],first[0]),b=forward(last[1],last[0]);
  if(![a.x,a.y,b.x,b.y].every(Number.isFinite))return [];
  let points=[];
  if(shape==="rectangle")points=[[a.x,a.y],[b.x,a.y],[b.x,b.y],[a.x,b.y]];
  else if(shape==="circle"){
   const radius=Math.hypot(b.x-a.x,b.y-a.y);if(radius<.01)return [];
   points=Array.from({length:96},(_,i)=>{const t=i*2*Math.PI/96;return[a.x+radius*Math.cos(t),a.y+radius*Math.sin(t)];});
  }else return [];
  if(shape==="rectangle"&&(Math.abs(b.x-a.x)<.01||Math.abs(b.y-a.y)<.01))return [];
  const ring=points.map(([x,y])=>{const p=inverse(x,y);return[p.lon,p.lat];});
  return ring.every(p=>p.every(Number.isFinite))?ring:[];
 }
 root.DG_BUILD_BOUNDARY_SHAPE_RING=Object.freeze({build});
})(window);
