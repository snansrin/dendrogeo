"use strict";
/* Calculate the shared UTM extent and canvas projection for map exports. */
(function(root){
 function prepare({cells,parkRings,epsg,forward}){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const project=(lat,lon)=>forward(lat,lon,epsg),include=(lat,lon)=>{const point=project(lat,lon);minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);};
  for(const cell of cells)for(const point of cell.quadWgs||[])include(point[1],point[0]);
  for(const ring of parkRings||[])for(const point of ring)include(point[0],point[1]);
  const width=maxX-minX,height=maxY-minY;
  return{minX,minY,maxX,maxY,canvasProject:(lat,lon,{x,y,width:canvasWidth,height:canvasHeight,margin=20})=>{const point=project(lat,lon),scale=Math.min((canvasWidth-margin*2)/(width||1),(canvasHeight-margin*2)/(height||1)),offsetX=x+(canvasWidth-width*scale)/2,offsetY=y+(canvasHeight-height*scale)/2;return[offsetX+(point.x-minX)*scale,offsetY+(maxY-point.y)*scale];}};
 }
 root.DG_PREPARE_SURFACE_EXPORT_MAP_FRAME=Object.freeze({prepare});
})(window);
