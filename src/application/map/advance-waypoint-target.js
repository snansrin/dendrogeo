"use strict";

/* Advance from the current waypoint ID and wrap to the first pending target. */
window.DG_ADVANCE_WAYPOINT_TARGET={
  advance({waypoints,currentId,next,onEmpty,onSelect}){
    const target=next(waypoints,currentId);
    if(!target){onEmpty();return{status:"empty"};}
    onSelect(target.id);
    return{status:"selected",target};
  }
};
