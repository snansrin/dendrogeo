"use strict";

/* Keep project preference, live presence, park gate and point suggestion ordered. */
window.DG_HANDLE_PARK_PROJECT_CHANGE={
  changed(ports){
    try{ports.rememberProject(ports.selectedValue());}catch(e){}
    try{ports.joinCurrentPark();}catch(e){}
    ports.refreshGate();
    if(!ports.hasManualPoint()&&!ports.isEditing())ports.refreshPointSuggestion();
  }
};
