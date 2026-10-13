"use strict";

/* Feature-scoped observable state; PROJ_LIST remains the legacy read facade. */
window.DG_MEASUREMENT_PROJECT_STATE={
  create(initial={}){
    let state=Object.freeze({projects:[],loading:false,error:null,...initial});
    const listeners=new Set();
    return Object.freeze({
      getState(){return state;},
      setState(patch){state=Object.freeze({...state,...patch});for(const listener of listeners)listener(state);return state;},
      subscribe(listener){if(typeof listener!=="function")throw new TypeError("listener must be a function");listeners.add(listener);return()=>listeners.delete(listener);}
    });
  }
};
