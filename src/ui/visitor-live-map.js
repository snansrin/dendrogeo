"use strict";

/* Own the Leaflet presentation for transient visitor locations. */
window.DG_VISITOR_LIVE_MAP_UI={
 create(){
  function initialize({element,map,layer,leaflet,attribution}){
   return window.DG_CREATE_VISITOR_LIVE_MAP_ADAPTER.initialize({element,map,layer,leaflet,attribution});
  }
  function draw({map,layer,leaflet,rows,hasLocation,viewLabels,translate,escape,colorFor,trails,follow,fit,buildTrail}){
   if(!map||!layer)return fit;
   try{map.invalidateSize();}catch(e){}
   layer.clearLayers();
   const frame=window.DG_PREPARE_LIVE_VISITOR_MAP_FRAME.prepare({rows,hasLocation,fit,follow});
   for(const row of frame.located){
    const color=colorFor(row.p.id)||"#2b6cb0";
    window.DG_VISITOR_LIVE_MAP_TRAILS_UI.render({leaflet,layer,row,color,trails,buildTrail,hasLocation});
    window.DG_ADD_VISITOR_LIVE_MAP_MARKER_UI.add({leaflet,layer,row,color,viewLabels,translate,escape});
   }
   return window.DG_VISITOR_LIVE_MAP_FIT_UI.apply({map,leaflet,located:frame.located,shouldFit:frame.shouldFit,follow,fit});
  }
  return Object.freeze({initialize,draw});
 }
};
