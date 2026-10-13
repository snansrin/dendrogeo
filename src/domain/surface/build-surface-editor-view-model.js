"use strict";

/* Reduce editor state to the flags needed by the review panel. */
window.DG_BUILD_SURFACE_EDITOR_VIEW_MODEL={
  build({record,busy,saving,exporting,vegetationCount}){
    const scanned=!!record?.profile?.cells;
    return{scanned,vegetationReady:scanned&&vegetationCount>=9,disabled:!!(busy||saving||exporting)};
  }
};
