"use strict";

/* Prepare, epoch-check and commit a review partition with existing busy cleanup. */
window.DG_REPARTITION_SURFACE_REVIEW={
  async repartition({state,featureOverride,buildInput,prepare,isCurrent,commit,render,refresh,onError}){
    const record=state.record;if(!record)return false;const epoch=state.epoch;let completed=false;
    state.busy=true;render();
    try{
      const input=buildInput(record,featureOverride),data=await prepare(input);
      if(!isCurrent({epoch,currentEpoch:state.epoch}))return false;
      commit(record,featureOverride,data,input.cells);completed=true;
    }catch(error){if(epoch===state.epoch)onError(error);}
    finally{if(epoch===state.epoch){state.busy=false;render();refresh();}}
    return completed;
  }
};
