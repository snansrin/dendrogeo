"use strict";

window.DG_CREATE_BASE_MAP_LAYER={
  create({leaflet,map,configuration}){const layer=leaflet.tileLayer(configuration.url,{attribution:configuration.attribution,maxZoom:configuration.maxZoom,maxNativeZoom:configuration.maxNativeZoom,keepBuffer:configuration.keepBuffer,updateWhenIdle:configuration.updateWhenIdle,updateWhenZooming:configuration.updateWhenZooming});layer._dgBase=configuration.type;layer.addTo(map);return layer;}
};
