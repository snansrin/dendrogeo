"use strict";

/* Keep the field's current-location marker behind an injected map adapter. */
window.DG_UPDATE_MEASUREMENT_GPS_MAP_MARKER={
  update(map,coords,ports){
    if(!map||!coords)return null;
    const previous=ports.getCurrentMarker();if(previous)map.removeLayer(previous);
    const marker=ports.createMarker([coords.latitude,coords.longitude],{radius:7,color:"#2b6cb0",weight:3,fillOpacity:.9}).addTo(map).bindPopup("Konumun");
    ports.setCurrentMarker(marker);return marker;
  }
};
