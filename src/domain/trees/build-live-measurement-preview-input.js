"use strict";

/* Convert the measurement form's string fields into the live-calculation DTO. */
window.DG_BUILD_LIVE_MEASUREMENT_PREVIEW_INPUT={
  build({circumference,height,species,group}){
    return{circumferenceCm:+circumference,heightM:+height,species,group};
  }
};
