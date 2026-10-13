"use strict";

/* Commit a successful scan profile, its disclosure status, and the device draft. */
window.DG_COMPLETE_SURFACE_SCAN={
  async complete({state,record,profile,autoWater,scanAudit,hasWaterFootprint,unresolvedWater,buildSummary,timestamp,dirty,refreshLayer,updateSummary,save}){
    record.profile=profile;state.vegetationRenderKey=null;record.spectralEnabled=false;record.scannedAt=timestamp();dirty();
    const audit=scanAudit(record);state.status=buildSummary({audit,autoWater,hasWaterFootprint:hasWaterFootprint(record),unresolvedWater:unresolvedWater()});
    refreshLayer();updateSummary();await save();return audit;
  }
};
