"use strict";
/* Keep waypoint selection state and the established redraw/focus order together. */
(function(root){
  function select({waypoints,id,setTarget,isManual,pointInput,draw,focus}){
    const point=waypoints.find(candidate=>candidate.id===id);
    if(!point)return;
    setTarget(point);
    if(!isManual())pointInput().value=point.wp_id;
    draw();
    focus();
  }
  root.DG_SELECT_WAYPOINT=Object.freeze({select});
})(window);
