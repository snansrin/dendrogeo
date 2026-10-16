"use strict";
/* Georeferenced image windows. Display zoom never defines source resolution. */
(function(root){
 const circumference=40075016.68557849;
 function pixel(lat,lon,zoom){const p=root.DG_WEB_MERCATOR_COORDINATES.forward(lat,lon),scale=256*2**zoom;return[(p.x/circumference+.5)*scale,(.5-p.y/circumference)*scale];}
 function coordinate(x,y,zoom){const scale=256*2**zoom,p=root.DG_WEB_MERCATOR_COORDINATES.reverse((x/scale-.5)*circumference,(.5-y/scale)*circumference);return[p.lat,p.lon];}
 function plan(park,{zoom=19,size=1024,overlap=128,maxChips=64}={}){
  if(!park?.outer?.length||!Number.isInteger(zoom)||zoom<17||zoom>19||size!==1024||overlap!==128)throw Error('park_required');
  const copy=JSON.parse(JSON.stringify({outer:park.outer,inner:park.inner||[]}));
  for(const ring of [...copy.outer,...copy.inner])if(!Array.isArray(ring)||ring.length<4||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>80||Math.abs(p[1])>180))throw Error('invalid_park');
  const boxes=copy.outer.map(ring=>{const points=ring.map(([lat,lon])=>pixel(lat,lon,zoom));return[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];});
  const bounds=[Math.floor(Math.min(...boxes.map(b=>b[0])))-64,Math.floor(Math.min(...boxes.map(b=>b[1])))-64,Math.ceil(Math.max(...boxes.map(b=>b[2])))+64,Math.ceil(Math.max(...boxes.map(b=>b[3])))+64];
  if(bounds[2]-bounds[0]>256*2**zoom/2)throw Error('invalid_park');
  const columns=Math.max(1,Math.ceil((bounds[2]-bounds[0]-size)/(size-overlap))+1),rows=Math.max(1,Math.ceil((bounds[3]-bounds[1]-size)/(size-overlap))+1);
  if(columns*rows>maxChips)throw Error('park_too_large');
  const chips=[];
  for(let y=bounds[1];y<bounds[3];y+=size-overlap){for(let x=bounds[0];x<bounds[2];x+=size-overlap){
   if(boxes.some(b=>b[0]<x+size&&b[2]>x&&b[1]<y+size&&b[3]>y))chips.push({id:chips.length,x,y,width:size,height:size,zoom});
   if(chips.length>maxChips)throw Error('park_too_large');if(x+size>=bounds[2])break;
  }if(y+size>=bounds[3])break;}
  if(!chips.length)throw Error('invalid_park');
  return{key:JSON.stringify(copy),park:copy,zoom,chips,bounds,source:'Esri World Imagery',sourceResolutionM:null,attribution:'© Esri, Vantor, Earthstar Geographics, and the GIS User Community'};
 }
 root.DG_PARK_TREE_SCAN_PLAN=Object.freeze({plan,pixel,coordinate});
})(window);
