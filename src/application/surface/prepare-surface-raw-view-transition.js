"use strict";

/* Stop edit tools and reset only transient map focus when changing surface views. */
window.DG_PREPARE_SURFACE_RAW_VIEW_TRANSITION={
  prepare({state,on,captureSnapshot,stopBrush,cancelDraw,cancelObject}){
    if(on)state.editView=captureSnapshot();
    stopBrush();cancelDraw();cancelObject();state.rawView=!!on;state.visualVersion++;state.focus=null;state.showCand=true;
    return state.editView;
  }
};
