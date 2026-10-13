"use strict";

/* Clear values belonging to the next tree while retaining project/species. */
window.DG_RESET_MEASUREMENT_ENTRY_FIELDS={
  reset(ports){
    for(const id of ["mPoint","mDbh","mHeight"])ports.element(id).value="";
    ports.clearPhoto();ports.element("pointQueryResult").style.display="none";
    ports.setManualPoint(false);ports.liveCalc();
  }
};
