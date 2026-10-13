"use strict";

window.DG_RENDER_WAYPOINT_GPS_OVERLAY={
  render({map,waypoints,target,gps,leaflet,distance,bearing,getElement,translate,setTarget}){
    const marker=window.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER,resolve=window.DG_RESOLVE_WAYPOINT_GPS_GUIDANCE,readout=window.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT,line=window.DG_ADD_WAYPOINT_GUIDANCE_LINE;
    if(!marker||!resolve||!readout||!line)return null;
    marker.add({map,gps,target,leaflet,bearing});
    const guidance=resolve.resolve({waypoints,target,gps,distance,bearing});
    if(guidance.target!==target&&guidance.target)setTarget(guidance.target);
    readout.render({...guidance,getElement,translate});
    if(guidance.target&&!guidance.target.visited)line.add({map,gps,target:guidance.target,leaflet});
    return guidance.target;
  }
};
