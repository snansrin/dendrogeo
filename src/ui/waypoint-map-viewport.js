"use strict";
/* Focus one waypoint or fit every waypoint while preserving map panel behavior. */
(function(root){
  function focus({showMap,map,target,gps,panel}){
    if(showMap){if(panel)panel.open=true;if(map?.invalidateSize)map.invalidateSize();}
    if(!target||!map)return;
    const point=[target.lat,target.lon];
    if(gps)map.fitBounds([[gps.latitude,gps.longitude],point],{padding:[36,36],maxZoom:18});
    else map.setView(point,18);
  }
  function fit({showMap,map,waypoints,gps,panel}){
    if(showMap){if(panel)panel.open=true;if(map?.invalidateSize)map.invalidateSize();}
    if(!map||!waypoints.length)return;
    const points=waypoints.map(point=>[point.lat,point.lon]);
    if(gps)points.push([gps.latitude,gps.longitude]);
    map.fitBounds(points,{padding:[36,36],maxZoom:18});
  }
  root.DG_WAYPOINT_MAP_VIEWPORT=Object.freeze({focus,fit});
})(window);
