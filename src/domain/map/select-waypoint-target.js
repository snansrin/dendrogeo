"use strict";
/* Select the nearest pending waypoint or advance in point-number order. */
(function(root){
  function nearest(waypoints,gps,distance){
    const pending=waypoints.filter(point=>!point.visited);
    if(!pending.length)return null;
    return pending.reduce((left,right)=>distance(gps.latitude,gps.longitude,left.lat,left.lon)<=distance(gps.latitude,gps.longitude,right.lat,right.lon)?left:right);
  }
  function next(waypoints,currentPointId){
    const pending=waypoints.filter(point=>!point.visited).sort((a,b)=>a.wp_id-b.wp_id);
    if(!pending.length)return null;
    return pending.find(point=>point.wp_id>currentPointId)||pending[0];
  }
  root.DG_WAYPOINT_TARGET=Object.freeze({nearest,next});
})(window);
