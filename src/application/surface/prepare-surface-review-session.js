"use strict";

/* Bind the loaded record to the active editor session before touching the map. */
window.DG_PREPARE_SURFACE_REVIEW_SESSION={
  prepare({state,record,cells,status}){
    state.record=record;state.opacity=record.displayOpacity??45;state.revision=record.serverRevision||0;state.editing=!!record.draftDirty||!record.acceptedAt||!record.acceptedResult;
    if(record.acceptedAt&&!record.acceptedResult)status("Önceki kabul alanları hesabınızda korunuyor. Bu yeni harita önizlemesini kontrol edip kaydedin.");
    state.focus=null;state.showCand=true;state.epsg=cells[0].epsg;
  }
};
