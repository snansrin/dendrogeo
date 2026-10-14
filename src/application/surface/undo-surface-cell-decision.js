"use strict";

/* Remove one cell decision and retain map refresh and local-save ordering. */
window.DG_UNDO_SURFACE_CELL_DECISION={
  undo({rawView,record,key,busy,saving,dirty,cellForKey,classForCell,previewCell,closePopup,refresh,summary,save}){
    if(rawView||!record||busy||saving)return false;
    delete record.corrections[key];dirty();const cell=cellForKey?.(key);if(cell)previewCell?.(cell,classForCell?.(cell)||cell.rasterClassKey||cell.classKey);closePopup();refresh();summary();save();return true;
  }
};
