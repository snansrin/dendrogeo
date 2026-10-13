"use strict";

/* Run optional spectral analysis with stale-park protection and guaranteed cleanup. */
window.DG_RUN_SURFACE_SCAN={
  async run({state,canRun,stopBrush,resetScanState,render,loadProfile,isCurrent,autoWater,complete,translate,toast,refreshLayer}){
    if(!canRun())return false;stopBrush();let completed=false;
    const record=state.record,epoch=state.epoch;resetScanState(record);state.visualVersion++;state.focus=null;state.busy=true;render();
    try{
      const profile=await loadProfile();if(!isCurrent(record,epoch))return;
      const objects=await autoWater(record,epoch);if(!isCurrent(record,epoch))return false;
      await complete({record,profile,autoWater:objects});completed=true;
    }catch(error){if(epoch===state.epoch){state.status=translate("Tarama başarısız: ")+String(error.message||error);toast(state.status,"err");}}
    finally{if(epoch===state.epoch){state.busy=false;render();refreshLayer();}}
    return completed;
  }
};
