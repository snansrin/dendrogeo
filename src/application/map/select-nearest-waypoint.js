"use strict";

/* Gate nearest-target selection on GPS and preserve the target selection port. */
window.DG_SELECT_NEAREST_WAYPOINT={
  select({waypoints,gps,distance,nearest,onGpsRequired,onEmpty,onSelect}){
    if(!gps){onGpsRequired();return{status:"gps-required"};}
    const target=nearest(waypoints,gps,distance);
    if(!target){onEmpty();return{status:"empty"};}
    onSelect(target.id);
    return{status:"selected",target};
  }
};
