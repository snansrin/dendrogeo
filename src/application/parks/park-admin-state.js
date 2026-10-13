"use strict";

/* Observable state scoped to the park-identity administration screen. */
window.DG_PARK_ADMIN_STATE={
  create(initial={}){
    let state=Object.freeze({rows:[],showEmpty:false,lastContext:null,...initial});
    const listeners=new Set();
    return Object.freeze({
      getState(){return state;},
      setState(patch){state=Object.freeze({...state,...patch});for(const listener of listeners)listener(state);return state;},
      subscribe(listener){if(typeof listener!=="function")throw new TypeError("listener must be a function");listeners.add(listener);return()=>listeners.delete(listener);}
    });
  }
};
