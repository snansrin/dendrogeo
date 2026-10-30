"use strict";

window.DG_ARRIVE_AT_WAYPOINT={
  async arrive({target,waypoints,gps,distance,selectTarget,confirmDistance,persist,complete,notify}){
    const waypoint=selectTarget({target,waypoints,gps,distance});
    if(!waypoint){notify("Aktif ölçüm noktası yok","warn","🎯");return;}
    if(!confirmDistance({target:waypoint,gps,distance}))return;
    complete(waypoint);
  }
};
