"use strict";

/* Update only supported brush classes and diameters, then close the active stroke. */
window.DG_UPDATE_SURFACE_BRUSH_CONFIG={
  update({state,type,size,types,allowed,stop,render}){
    if(types[type])state.brushType=type;if(allowed.includes(size))state.brushDiameter=size;stop();render();
    return{type:state.brushType,size:state.brushDiameter};
  }
};
