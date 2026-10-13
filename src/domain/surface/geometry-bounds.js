"use strict";
/* Geographic and projected bounding boxes used by raster/park intersections. */
(function(root){
  function fromGeometry(outer,holes){
    let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
    const visit=ring=>{for(const point of (ring||[])){const lat=Number(point?.[0]),lon=Number(point?.[1]);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);}};
    (outer||[]).forEach(visit);(holes||[]).forEach(visit);
    if(!(minLat<=maxLat&&minLon<=maxLon))throw new Error("Park polygonu için geçerli koordinat kutusu üretilemedi.");
    return{minLat,maxLat,minLon,maxLon};
  }
  function ringXY(ring){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of (ring||[])){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}return{minX,minY,maxX,maxY};}
  function overlap(a,b){if(!a||!b)return false;return !(a.maxX<=b.minX||a.minX>=b.maxX||a.maxY<=b.minY||a.minY>=b.maxY);}
  function quad(geometry){return geometry.reduce((box,p)=>({minX:Math.min(box.minX,p.x),minY:Math.min(box.minY,p.y),maxX:Math.max(box.maxX,p.x),maxY:Math.max(box.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});}
  root.DG_SURFACE_GEOMETRY_BOUNDS=Object.freeze({fromGeometry,ringXY,overlap,quad});
})(window);
