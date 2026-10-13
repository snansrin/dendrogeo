"use strict";

window.DG_SELECT_RESTORED_WAYPOINT_TARGET={
  select(waypoints,previousTarget){return waypoints.find(point=>point.id===previousTarget?.id&&!point.visited)||null;}
};
