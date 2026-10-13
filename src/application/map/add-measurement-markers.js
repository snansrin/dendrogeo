"use strict";

window.DG_ADD_MEASUREMENT_MARKERS={
  add(map,rows,chunk,{leaflet,popupHTML,log=console,setTimer=setTimeout,ensureLayer,clusterIcon,createMarker,schedule}){
    if(!ensureLayer||!clusterIcon||!createMarker||!schedule)return false;
    ensureLayer.ensure(map,{leaflet,log,clusterIcon:clusterIcon.create});
    const token=map._markerToken=(map._markerToken||0)+1;
    schedule.schedule({map,rows,chunk,token,createMarker:row=>createMarker.create(row,{leaflet,popupHTML}),setTimer});
    return true;
  }
};
