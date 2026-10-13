"use strict";

/* Reject merge results when the editor state changed during asynchronous work. */
window.DG_IS_SURFACE_LAYER_RENDER_CURRENT={
  check({state,epoch,key,buildKey}){return epoch===state.epoch&&key===buildKey(state);}
};
