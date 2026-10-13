"use strict";

/* Filter displayed surface classes without editing raster or review data. */
window.DG_FOCUS_SURFACE_CLASS={
  focus({state,type,refresh}){state.focus=type;refresh();}
};
