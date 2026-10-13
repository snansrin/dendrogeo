"use strict";

/* Keep the destructive reset confirmation and clear only user-authored review state. */
window.DG_RESET_SURFACE_CORRECTIONS={
  reset({rawView,busy,saving,confirmReset,record,dirty,repartition,save}){
    if(rawView||busy||saving||!confirmReset())return;
    record.corrections={};record.features=[];record.brushHistory=[];dirty();repartition().then(ok=>ok&&save());
  }
};
