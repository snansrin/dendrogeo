"use strict";

/* Create the visitor map and its OSM layer from injected browser dependencies. */
window.DG_CREATE_VISITOR_LIVE_MAP_ADAPTER={
  initialize({element,map,layer,leaflet,attribution}){
    if(!element||map||!leaflet)return{map,layer};
    try{
      map=leaflet.map("visMap").setView([39,35],6);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution,maxZoom:19}).addTo(map);
      layer=leaflet.layerGroup().addTo(map);
    }catch(_){map=null;layer=null;}
    return{map,layer};
  }
};
