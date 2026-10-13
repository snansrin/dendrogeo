"use strict";

/* Keep scan-period choices behind the existing edit/session gates. */
window.DG_SELECT_SURFACE_SCAN_PERIOD={
  select({state,value,scan}){
    if(state.rawView||state.brush||state.busy||state.saving||!state.record)return false;
    state.record.period=value==="ref"?"ref":value==="latest"?"latest":"ytd";
    state.record.periodExplicit=true;scan();return true;
  }
};
