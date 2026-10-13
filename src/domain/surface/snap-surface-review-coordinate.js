"use strict";

/* Snap projected review coordinates to the established millimetre grid. */
window.DG_SNAP_SURFACE_REVIEW_COORDINATE={
  snap(x,y){return[Math.round(x*1000)/1000,Math.round(y*1000)/1000];}
};
