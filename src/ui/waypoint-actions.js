"use strict";

/* Field navigation controls are owned by one delegated waypoint UI module. */
(function(root){
  const handlers={
    load:()=>root.loadWaypoints(),
    nearest:()=>root.dgNearestWaypoint(),
    next:()=>root.dgNextWaypoint(),
    focus:()=>root.dgFocusWaypoint(true),
    fit:()=>root.dgFitWaypoints(true),
    gps:()=>root.startGps(),
    arrive:()=>root.arriveWp(),
    render:()=>root.renderWaypointList(),
    "file-name":(element,event)=>root.dgFileName(event,"nCsvName"),
    upload:()=>root.uploadWpCsv(),
    "delete-all":()=>root.deleteAllWaypoints(),
    "map-panel":element=>{if(element.open&&typeof navMap!=="undefined"&&navMap){navMap.invalidateSize();root.dgFocusWaypoint();}}
  };
  function bind({document}){
    if(root._dgWaypointActionsBound)return;
    root._dgWaypointActionsBound=true;
    const actionFrom=target=>target?.closest?.("[data-dg-waypoint-action]");
    for(const type of ["click","change","input","toggle"]){
      document.addEventListener(type,event=>{
        const element=actionFrom(event.target);if(!element)return;
        const action=element.dataset.dgWaypointAction,handler=handlers[action];
        if(!handler)return;
        if((action==="render"&&type!=="input"&&type!=="change")||
           (action==="map-panel"&&type!=="toggle")||
           (action==="load"&&type!=="change")||
           (action==="file-name"&&type!=="change")||
           (["nearest","next","focus","fit","gps","arrive","upload","delete-all"].includes(action)&&type!=="click"))return;
        handler(element,event);
      });
    }
  }
  root.DG_WAYPOINT_ACTIONS=Object.freeze({bind});
})(window);

window.DG_WAYPOINT_ACTIONS.bind({document});
