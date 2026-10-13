"use strict";

window.DG_RESOLVE_WAYPOINT_GPS_GUIDANCE={
  resolve({waypoints,target,gps,distance,bearing}){
    if(!target){
      const pending=waypoints.filter(point=>!point.visited);
      if(pending.length)target=pending.sort((left,right)=>distance(gps.latitude,gps.longitude,left.lat,left.lon)-distance(gps.latitude,gps.longitude,right.lat,right.lon))[0];
    }
    if(!target||target.visited)return{target,meters:null,targetBearing:null};
    return{target,meters:distance(gps.latitude,gps.longitude,target.lat,target.lon),targetBearing:bearing(gps.latitude,gps.longitude,target.lat,target.lon)};
  }
};
