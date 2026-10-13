"use strict";

window.DG_MANAGE_BASE_MAP_LAYERS={
  hasCurrent(map,type){let current=null;map.eachLayer(layer=>{if(layer._dgBase===type)current=layer;});return!!current;},
  removeTileLayers(map){map.eachLayer(layer=>{if(layer._url)map.removeLayer(layer);});}
};
