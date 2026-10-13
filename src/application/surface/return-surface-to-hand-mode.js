"use strict";

/* Stop active drawing tools and restore the normal map interaction mode. */
window.DG_RETURN_SURFACE_TO_HAND_MODE={
  run({state,stopBrush,cancelDraw,render}){
    stopBrush();if(state.draw)cancelDraw();render();
  }
};
