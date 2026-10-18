"use strict";

window.DG_CREATE_BASE_MAP_LAYER={
  create({leaflet,map,configuration}){const layer=leaflet.tileLayer(configuration.url,{attribution:configuration.attribution,maxZoom:configuration.maxZoom,maxNativeZoom:configuration.maxNativeZoom,keepBuffer:configuration.keepBuffer,updateWhenIdle:configuration.updateWhenIdle,updateWhenZooming:configuration.updateWhenZooming});
    if(configuration.type==='sat')window.DG_RECOVER_IMAGERY_TILES.install(layer,{url:configuration.url,document:window.document,setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)});
    layer._dgBase=configuration.type;layer.addTo(map);return layer;}
};
