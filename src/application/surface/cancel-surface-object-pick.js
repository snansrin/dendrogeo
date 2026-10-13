"use strict";
window.DG_CANCEL_SURFACE_OBJECT_PICK={cancel({state,map,onPick,preview,layer,removeLayer}){if(state.objectPick&&map)map.off("click",onPick);state.objectPick=false;state.objectPreview=null;if(preview)preview.remove({map,layer});else if(layer&&map)removeLayer(map,layer);return null;}};
