"use strict";

/* Orchestrate safe raw/edit transitions and summary refresh. */
window.DG_SWITCH_SURFACE_RAW_VIEW={
  async switch({state,on,allowed,captureSnapshot,prepareTransition,canRestore,restoreCache,repartition,stopBrush,cancelDraw,cancelObject,map,removeLayer,render,refresh,updateSummary}){
    if(!allowed({record:state.record,busy:state.busy,saving:state.saving,exporting:state.exporting,rawView:state.rawView,on}))return;
    const record=state.record,epoch=state.epoch;
    prepareTransition({state,on,captureSnapshot,stopBrush,cancelDraw,cancelObject});
    const prepared=state.editView;
    if(!on&&canRestore(prepared,{record,epoch})&&prepared.geometry)await restoreCache({state,record,epoch,prepared,map,removeLayer,render,refresh});
    else await repartition();
    if(epoch===state.epoch&&state.record===record)updateSummary();
  }
};
