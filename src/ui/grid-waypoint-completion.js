"use strict";
/* Refresh the waypoint view after a successful persisted batch. */
(function(root){
  function completeGridWaypoints({result,projectId,renderLayer,setLayer,getProjectControl,loadWaypoints,notify,clearSelection}){
    const {rows,first,next}=result;
    setLayer(renderLayer(rows));
    getProjectControl().value=String(projectId);
    loadWaypoints();
    notify("✓ "+rows.length+" ölçüm noktası (P"+first+"–P"+(next-1)+")","ok","📍");
    clearSelection();
    if(root.DG_LIVE_MAP_PROJECTS?.refreshWaypoints)void root.DG_LIVE_MAP_PROJECTS.refreshWaypoints(projectId).catch(error=>notify("Noktalar kaydedildi; harita yenilenemedi: "+error.message,"warn"));
  }
  root.DG_GRID_WAYPOINT_COMPLETION_UI=Object.freeze({complete:completeGridWaypoints});
})(window);
