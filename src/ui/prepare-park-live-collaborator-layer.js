"use strict";

/* Reuse the current Leaflet group across Presence sync events. */
window.DG_PREPARE_PARK_LIVE_COLLABORATOR_LAYER={
  prepare({layer,map,leaflet,setLayer}){
    if(!layer){layer=leaflet.layerGroup().addTo(map);setLayer(layer);}
    layer.clearLayers();return layer;
  }
};
