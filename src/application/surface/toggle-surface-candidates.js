"use strict";

/* Show or hide candidate surfaces and immediately refresh the map and tools. */
window.DG_TOGGLE_SURFACE_CANDIDATES={
  toggle({state,on,refresh,render}){state.showCand=!!on;refresh();render();}
};
