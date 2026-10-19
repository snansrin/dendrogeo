"use strict";
/* Stage a road width edit without changing the analysis or accepted record. */
window.DG_PREVIEW_SURFACE_ROAD_WIDTH={
 update({state,width,build,render,remove,renderTools,report}){
  if(state.busy||state.saving||state.exporting||state.rawView||!state.objectPreview?.roadSource)return false;
  try{
   const next=build(state.objectPreview,width),layer=render(next);
   remove(state.objectPreviewLayer);state.objectPreview=next;state.objectPreviewLayer=layer;
   renderTools();return true;
  }catch(error){report(String(error.message||error));return false;}
 }
};
