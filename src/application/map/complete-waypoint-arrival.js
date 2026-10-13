"use strict";

window.DG_COMPLETE_WAYPOINT_ARRIVAL={
  complete({waypoint,isManual,setPoint,setTarget,draw,refresh,hasProjectField,setProject,notify,format,go}){
    waypoint.visited=true;
    setTarget(null);
    if(!isManual())setPoint(waypoint.wp_id);
    draw();
    refresh();
    if(waypoint.project_id&&hasProjectField())setProject(String(waypoint.project_id));
    notify(format("✓ Vardın: P{id} → ölçüme geç",{id:waypoint.wp_id}),"ok","🎯");
    go("measure");
  }
};
