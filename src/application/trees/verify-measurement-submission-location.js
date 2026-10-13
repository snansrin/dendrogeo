"use strict";

/* Verify new rows at their linked park before photo upload or persistence. */
window.DG_VERIFY_MEASUREMENT_SUBMISSION_LOCATION={
  async verify(draft,ports){
    if(draft.wasEdit||!draft.gate.project?.park_id)return{ok:true,draft};
    const park=await ports.loadPark(draft.gate.project.park_id);
    if(!park)return{ok:true,draft};
    const decision=await ports.verifyAtPark(park);
    if(!decision.ok)return{ok:false,park,decision};
    ports.stamp(draft.record,decision);
    return{ok:true,draft,park,decision};
  }
};
