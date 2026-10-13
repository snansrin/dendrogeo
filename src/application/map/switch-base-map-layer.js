"use strict";

window.DG_SWITCH_BASE_MAP_LAYER={
  switch({map,type,resolve,syncSelection,hasCurrent,removeTileLayers,createLayer,notify}){
    if(!map)return;
    const configuration=resolve(type);
    if(!configuration)return;
    syncSelection(type);
    if(hasCurrent(map,type))return;
    removeTileLayers(map);
    createLayer(map,configuration);
    notify("✓ Harita: "+configuration.label,"ok","🗺️");
  }
};
