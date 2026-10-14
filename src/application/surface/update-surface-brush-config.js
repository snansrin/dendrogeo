"use strict";

/* Update only supported brush classes and diameters, then close the active stroke. */
window.DG_UPDATE_SURFACE_BRUSH_CONFIG={
  update({state,type,size,types,allowed,stop,toggle,render}){
    if(state.rawView||state.busy||state.saving||state.exporting)return{type:state.brushType,size:state.brushDiameter};
    const active=!!state.brush;
    if(type==="pool")type="water";if(types[type])state.brushType=type;if(allowed.includes(size))state.brushDiameter=size;stop();if(active&&toggle)toggle();else render();
    return{type:state.brushType,size:state.brushDiameter};
  }
};
