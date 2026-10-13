"use strict";

/* Remove Leaflet presentation layers after replacing prepared review geometry. */
window.DG_CLEAR_SURFACE_REVIEW_LAYERS={
  clear({state,map}){
    if(state.layer)map.removeLayer(state.layer);if(state.boundaryLayer)map.removeLayer(state.boundaryLayer);if(state.renderer)map.removeLayer(state.renderer);
    state.layer=null;state.boundaryLayer=null;state.boundaryKey=null;state.renderer=null;
  }
};
