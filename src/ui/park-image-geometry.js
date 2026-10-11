"use strict";
/* Coordinate projection and ring tracing helpers for the vector park PNG. */
(function(root){
 function project({minLat,maxLat,minLon,maxLon,width,heightTop,scale}){
  const lat0=(minLat+maxLat)/2,lon0=(minLon+maxLon)/2;
  const MX=111320*Math.cos(lat0*Math.PI/180),MY=110540;
  const X=lon=>width/2+(lon-lon0)*MX*scale;
  const Y=lat=>heightTop+(maxLat-lat)*MY*scale;
  return{lat0,lon0,MX,MY,scale,X,Y,x:X,y:Y};
 }
 function appendRing({context,projector,ring}){
  ring.forEach((point,index)=>{
   const x=projector.X(point[1]),y=projector.Y(point[0]);
   if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
  });
  context.closePath();
 }
 function traceRing({context,projector,ring}){
  context.beginPath();
  appendRing({context,projector,ring});
 }
 root.DG_PARK_IMAGE_GEOMETRY=Object.freeze({project,appendRing,traceRing});
})(window);
