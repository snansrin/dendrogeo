"use strict";

window.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER={
  add({map,gps,target,leaflet,bearing}){
    const arrowBearing=target&&!target.visited?bearing(gps.latitude,gps.longitude,target.lat,target.lon):null;
    const marker=leaflet.marker([gps.latitude,gps.longitude],{icon:leaflet.divIcon({className:"",html:`<div class="loc-marker">${arrowBearing!=null?`<svg class="nav-arrow-svg" viewBox="0 0 100 100" style="transform:rotate(${arrowBearing}deg)"><path d="M50 5 L70 70 L50 55 L30 70 Z" fill="#2b6cb0" stroke="#fff" stroke-width="4"/></svg>`:""}<div class="dot"></div></div>`,iconSize:[48,48],iconAnchor:[24,24]}),zIndexOffset:1000}).addTo(map);
    marker._wp=1;
    return marker;
  }
};
