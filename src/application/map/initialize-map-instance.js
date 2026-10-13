"use strict";

window.DG_INITIALIZE_MAP_INSTANCE={
  initialize({getMap,setMap,create,addLayer}){
    const current=getMap();
    if(current)return current;
    const map=create();
    setMap(map);
    addLayer(map);
    return map;
  }
};
