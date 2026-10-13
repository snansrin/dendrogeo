"use strict";

/* Complete a bulk backfill result in the established clear/refresh order. */
window.DG_COMPLETE_PARK_BACKFILL_APPLY={
  complete({result,showResult,clearPlan,closePlan,refresh}){
    if(!result||result.status!=="applied")return false;
    showResult(result);
    clearPlan();
    closePlan();
    refresh();
    return true;
  }
};
