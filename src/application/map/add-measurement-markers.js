"use strict";

window.DG_ADD_MEASUREMENT_MARKERS={
  add(map,rows,chunk,{leaflet,popupHTML,log=console,setTimer=setTimeout}){
    const modules=[window.DG_ENSURE_MEASUREMENT_MARKER_LAYER,window.DG_MEASUREMENT_MARKER_CLUSTER_ICON,window.DG_CREATE_MEASUREMENT_MAP_MARKER,window.DG_SCHEDULE_MEASUREMENT_MARKER_CHUNKS];
    if(modules.some(module=>!module))return false;
    modules[0].ensure(map,{leaflet,log,clusterIcon:modules[1].create});
    const token=map._markerToken=(map._markerToken||0)+1;
    modules[3].schedule({map,rows,chunk,token,createMarker:row=>modules[2].create(row,{leaflet,popupHTML}),setTimer});
    return true;
  }
};
