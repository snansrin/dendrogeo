"use strict";

/* Include every state dimension that changes the merged display geometry. */
window.DG_BUILD_SURFACE_LAYER_RENDER_KEY={
  build(state){return[state.epoch,state.partitionVersion,state.visualVersion,state.editing].join(":");}
};
