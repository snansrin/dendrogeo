"use strict";

window.DG_ADD_WAYPOINT_GUIDANCE_LINE={
  add({map,gps,target,leaflet}){
    const line=leaflet.polyline([[gps.latitude,gps.longitude],[target.lat,target.lon]],{color:"#c2452d",dashArray:"5,8",weight:2}).addTo(map);
    line._wp=1;
    return line;
  }
};
