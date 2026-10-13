"use strict";

window.DG_MAP_INITIAL_VIEW={
  resolve(name){
    if(name==="map")return{center:[39.99,32.65],zoom:12};
    if(name==="navMap")return{center:[39.992,32.6498],zoom:15};
    if(name==="worldMap")return{center:[39,35],zoom:3};
    return null;
  }
};
