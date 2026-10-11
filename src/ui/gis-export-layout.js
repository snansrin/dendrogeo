/* Bounds, sizing, and projection inputs for the standard GIS PNG layout. */
(function(root){
 "use strict";
 function compute({rings,ndvi,project}){
  const bounds={minLat:90,maxLat:-90,minLon:180,maxLon:-180};
  function grow(point){
   if(!Array.isArray(point)||point.length<2||!Number.isFinite(point[0])||!Number.isFinite(point[1]))return;
   bounds.minLat=Math.min(bounds.minLat,point[0]);bounds.maxLat=Math.max(bounds.maxLat,point[0]);
   bounds.minLon=Math.min(bounds.minLon,point[1]);bounds.maxLon=Math.max(bounds.maxLon,point[1]);
  }
  for(const ring of rings)for(const point of ring)grow(point);
  if(bounds.maxLat<=bounds.minLat||bounds.maxLon<=bounds.minLon)return null;
  const centerLat=(bounds.minLat+bounds.maxLat)/2;
  const mx=111320*Math.cos(centerLat*Math.PI/180),my=110540;
  const wMeters=(bounds.maxLon-bounds.minLon)*mx+30,hMeters=(bounds.maxLat-bounds.minLat)*my+30;
  const PAD=76,TOP=110,LEGEND=ndvi?206:146;
  const scale=Math.min((1600-PAD*2)/wMeters,(1200-PAD*2)/hMeters);
  const W=Math.max(940,Math.ceil(wMeters*scale+PAD*2));
  const H=Math.ceil(hMeters*scale+TOP+PAD+LEGEND);
  const projection=project({minLat:bounds.minLat-15/my,maxLat:bounds.maxLat+15/my,
   minLon:bounds.minLon,maxLon:bounds.maxLon,width:W,heightTop:TOP,scale});
  return{bounds,mx,my,wMeters,hMeters,scale,W,H,PAD,TOP,LEGEND,projection};
 }
 root.DG_GIS_EXPORT_LAYOUT=Object.freeze({compute});
})(window);
