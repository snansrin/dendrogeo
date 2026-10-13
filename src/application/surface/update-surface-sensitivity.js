"use strict";

/* Update one spectral threshold and preserve its debounced map refresh. */
window.DG_UPDATE_SURFACE_SENSITIVITY={
  update({state,type,value,classes,dirty,clearTimer,setTimer,refresh,summary,status,delay=250}){
    const record=state.record;if(!record||state.rawView||state.brush||state.busy||state.saving||!classes.includes(type))return false;
    const number=Number(value);record.sens[type]=Number.isFinite(number)?Math.max(0,Math.min(100,number)):50;
    record.spectralEnabled=true;dirty();state.focus=type;state.showCand=true;state.status="";
    clearTimer(state.debounce);state.debounce=setTimer(()=>{state.debounce=null;refresh();summary();status();},delay);return true;
  }
};
