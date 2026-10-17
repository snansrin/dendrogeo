"use strict";

window.DG_CREATE_BASE_MAP_LAYER={
  create({leaflet,map,configuration}){
   const layer=leaflet.tileLayer(configuration.url,{attribution:configuration.attribution,maxZoom:configuration.maxZoom,maxNativeZoom:configuration.maxNativeZoom,keepBuffer:configuration.keepBuffer,updateWhenIdle:configuration.updateWhenIdle,updateWhenZooming:configuration.updateWhenZooming});
   layer._dgBase=configuration.type;
   map.setMaxZoom?.(configuration.maxZoom);
   // Imagery coverage varies geographically. Missing high-level tiles fall back
   // through native levels; a stale tile error cannot keep reducing the level.
   if(configuration.type==="sat"){
    const centerKey=()=>{const center=map.getCenter?.();return center?center.lat.toFixed(5)+":"+center.lng.toFixed(5):"";};
    let coverageCenter=centerKey();
    const retryCoverage=()=>{
     const nextCenter=centerKey();if(nextCenter===coverageCenter)return;coverageCenter=nextCenter;
     if(layer.options.maxNativeZoom>=configuration.maxNativeZoom)return;
     layer.options.maxNativeZoom=configuration.maxNativeZoom;
     layer.redraw();
    };
    map.on?.("moveend",retryCoverage);
    layer.on("remove",()=>map.off?.("moveend",retryCoverage));
    layer.on("tileerror",event=>{
    const zoom=event.coords?.z;
    if(!Number.isInteger(zoom)||zoom<=19||zoom>layer.options.maxNativeZoom||(Number.isFinite(layer._tileZoom)&&zoom!==layer._tileZoom))return;
    layer.options.maxNativeZoom=zoom-1;
    // Keep the requested view and interaction ceiling; scale the best available tile.
    layer.redraw();
    });
   }
   layer.addTo(map);return layer;
  }
};
