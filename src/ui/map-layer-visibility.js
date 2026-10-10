"use strict";
/* Toggle an existing Leaflet layer and mirror its state in the supplied control. */
(function(root){
  function toggleMapLayerVisibility({map,layer,control}){
    if(!layer)return;
    if(map.hasLayer(layer)){
      map.removeLayer(layer);
      if(control)control.checked=false;
    }else{
      map.addLayer(layer);
      if(control)control.checked=true;
    }
  }
  root.DG_MAP_LAYER_VISIBILITY_UI=Object.freeze({toggle:toggleMapLayerVisibility});
})(window);
