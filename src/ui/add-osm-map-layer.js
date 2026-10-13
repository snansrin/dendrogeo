"use strict";

window.DG_ADD_OSM_MAP_LAYER={
  add({leaflet,map,attribution}){return leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution,maxZoom:19}).addTo(map);}
};
