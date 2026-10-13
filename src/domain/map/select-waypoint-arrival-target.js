"use strict";

window.DG_SELECT_WAYPOINT_ARRIVAL_TARGET={
  select({target,waypoints,gps,distance}){
    if(!target||target.visited){
      const pending=waypoints.filter(point=>!point.visited);
      if(pending.length&&gps)target=pending.sort((left,right)=>distance(gps.latitude,gps.longitude,left.lat,left.lon)-distance(gps.latitude,gps.longitude,right.lat,right.lon))[0];
    }
    return target;
  }
};
