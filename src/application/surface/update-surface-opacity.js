"use strict";

/* Persist display opacity with the existing debounce and refresh map fills. */
window.DG_UPDATE_SURFACE_OPACITY={
  update({state,value,document,clearTimer,setTimer,save,delay=900}){
    state.opacity=Math.max(0,Math.min(100,Number(value)||0));
    if(state.record){state.record.displayOpacity=state.opacity;clearTimer(state.saveTimer);state.saveTimer=setTimer(()=>save(),delay);}
    const output=document.getElementById("dgSensOpacityValue");if(output)output.textContent="%"+state.opacity;
    for(const path of state.displayPaths||[])path.poly.setStyle({fillOpacity:state.opacity/100});
    return state.opacity;
  }
};
