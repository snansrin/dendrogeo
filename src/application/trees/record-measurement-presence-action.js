"use strict";

/* Presence is best-effort and must never block a saved measurement. */
window.DG_RECORD_MEASUREMENT_PRESENCE_ACTION={
  record(action,pointLabel,recordPresence){
    if(typeof recordPresence!=="function")return;
    try{recordPresence(action,pointLabel);}catch(error){}
  }
};
