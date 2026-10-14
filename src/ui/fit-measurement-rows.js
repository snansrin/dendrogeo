"use strict";
(function(root){
 function fit(map,rows,label,icon,{isValidCoordinate,bounds,toast,translate}){
  const points=(rows||[]).filter(row=>isValidCoordinate(row.lat,row.lon));
  if(!points.length)return toast(label+" "+translate("için onaylı nokta yok"),"warn",icon);
  map.fitBounds(bounds(points.map(row=>[+row.lat,+row.lon])).pad(0.25),{maxZoom:12});
  toast(label+" haritada","info",icon);
 }
 root.DG_FIT_MEASUREMENT_ROWS=Object.freeze({fit});
})(window);
