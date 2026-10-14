"use strict";

/* Keep brush mode gates and restart the active brush with the selected class. */
window.DG_SELECT_SURFACE_BRUSH_TYPE={
  select({state,type,types,stop, toggle,render}){
    if(type==="pool")type="water";
    if(!types[type]||state.rawView||state.busy||state.saving)return false;
    state.brushType=type;if(state.brush)stop();toggle();return true;
  }
};
