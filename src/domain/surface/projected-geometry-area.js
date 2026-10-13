"use strict";
/* Combine projected geometry, shoelace area, and park/cell intersection area. */
(function(root){
  function planarArea(poly){if(!Array.isArray(poly)||poly.length<3)return 0;let sum=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];sum+=a.x*b.y-b.x*a.y;}return Math.abs(sum)/2;}
  function quadBBox(quad){return quad.reduce((box,p)=>({minX:Math.min(box.minX,p.x),minY:Math.min(box.minY,p.y),maxX:Math.max(box.maxX,p.x),maxY:Math.max(box.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});}
  function intersectionArea(outerRings,holeRings,rect,{overlap,clip,area}){let total=0;for(const ring of (outerRings||[])){if(!overlap(ring._bbox,rect))continue;total+=area(clip(ring,rect));}for(const ring of (holeRings||[])){if(!overlap(ring._bbox,rect))continue;total-=area(clip(ring,rect));}return Math.max(0,total);}
  function intersectionAreaConvex(outerRings,holeRings,quad,{overlap,clip,area}){let total=0;for(const ring of (outerRings||[])){if(!overlap(ring._bbox,quad._bbox))continue;total+=area(clip(ring,quad));}for(const ring of (holeRings||[])){if(!overlap(ring._bbox,quad._bbox))continue;total-=area(clip(ring,quad));}return Math.max(0,total);}
  function projectGeometry(outer,holes,epsg,{forward,ringBBox}){const projectRing=ring=>{const points=(ring||[]).map(point=>{const projected=forward(Number(point[0]),Number(point[1]),epsg);return{x:projected.x,y:projected.y};});points._bbox=ringBBox(points);return points;};return{outer:(outer||[]).map(projectRing).filter(ring=>ring.length>=3),holes:(holes||[]).map(projectRing).filter(ring=>ring.length>=3)};}
  function projectedArea(geometry){let total=0;for(const ring of geometry.outer)total+=planarArea(ring);for(const ring of geometry.holes)total-=planarArea(ring);return Math.max(0,total);}
  root.DG_SURFACE_PROJECTED_GEOMETRY_AREA=Object.freeze({planarArea,quadBBox,intersectionArea,intersectionAreaConvex,projectGeometry,projectedArea});
})(window);
