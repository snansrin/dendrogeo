"use strict";

window.DG_CREATE_MEASUREMENT_MAP_MARKER={
  create(row,{leaflet,popupHTML}){
    const marker=leaflet.marker([row.lat,row.lon],{
      icon:leaflet.divIcon({className:'tree-marker',html:`<div style="width:14px;height:14px;border-radius:50%;background:#1e6f4b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,iconSize:[18,18],iconAnchor:[9,9]})
    });
    marker.bindPopup(popupHTML(row));
    return marker;
  }
};
