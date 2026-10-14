"use strict";

/* Apply a validated user class choice and preserve the established refresh/save order. */
window.DG_APPLY_SURFACE_CELL_DECISION={
  apply({rawView,cell,types,toClass,busy,saving,createDecision,dirty,previewCell,closePopup,refresh,summary,status,save}){
    if(rawView||!cell||!types[toClass]||busy||saving)return false;
    if(!createDecision(cell,toClass))return false;
    dirty();previewCell?.(cell,toClass);closePopup();refresh();summary();status();save();return true;
  },
  bulk({candidates,classKey,cellKey,apply}){for(const candidate of candidates)apply(cellKey(candidate.cell),classKey);}
};
