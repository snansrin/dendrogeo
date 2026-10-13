"use strict";

/* Apply a successful manual backfill to its plan row, feedback, and refreshes. */
window.DG_COMPLETE_MANUAL_BACKFILL_PARK={
  complete({result,buildUpdate,updateRow,showSuccess,renderPlan,refresh}){
    if(!result||result.status!=="created")return false;
    const patch=buildUpdate(result.row,result.park);
    updateRow(result.row,patch);
    showSuccess(result.park);
    renderPlan();
    refresh();
    return true;
  }
};
