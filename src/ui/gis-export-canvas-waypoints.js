/* Waypoint markers for standard and verified GIS PNG exports. */
(function(root){
 "use strict";
 function drawWaypoints(context,projector,waypoints){
  for(const waypoint of waypoints||[]){
   if(!Number.isFinite(waypoint.lat)||!Number.isFinite(waypoint.lon))continue;
   context.fillStyle=waypoint.visited?"#16a34a":"#e11d48";
   context.beginPath();context.arc(projector.x(waypoint.lon),projector.y(waypoint.lat),5,0,Math.PI*2);context.fill();
   context.strokeStyle="#fff";context.lineWidth=1.7;context.stroke();
  }
 }
 function drawVerifiedWaypoints(context,projector,waypoints,ink){
  for(const waypoint of waypoints||[]){
   const x=projector.x(Number(waypoint.lon)),y=projector.y(Number(waypoint.lat));
   context.beginPath();context.arc(x,y,7,0,Math.PI*2);
   context.fillStyle=waypoint.visited?"#22c55e":"#ef4444";context.fill();
   context.strokeStyle="#fff";context.lineWidth=2;context.stroke();
   context.fillStyle=ink;context.font="bold 14px Arial";
   context.fillText(String(waypoint.wp_id??waypoint.id??""),x+10,y+4);
  }
 }
 root.DG_GIS_EXPORT_CANVAS_WAYPOINTS=Object.freeze({drawWaypoints,drawVerifiedWaypoints});
})(window);
