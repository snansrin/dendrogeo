"use strict";

window.DG_RENDER_WAYPOINT_GPS_OVERLAY={
  render({map,waypoints,target,gps,leaflet,distance,bearing,getElement,translate,setTarget,createLocationMarker,renderReadout,addGuidanceLine}){
    const resolve=window.DG_RESOLVE_WAYPOINT_GPS_GUIDANCE;
    if(!createLocationMarker||!resolve||!renderReadout||!addGuidanceLine)return null;
    createLocationMarker.add({map,gps,target,leaflet,bearing});
    const guidance=resolve.resolve({waypoints,target,gps,distance,bearing});
    if(guidance.target!==target&&guidance.target)setTarget(guidance.target);
    renderReadout.render({...guidance,gps,getElement,translate});
    if(guidance.target&&!guidance.target.visited)addGuidanceLine.add({map,gps,target:guidance.target,leaflet});
    return guidance.target;
  }
};
