"use strict";

/* Generation token that prevents an older async photo check replacing a newer choice. */
window.DG_MEASUREMENT_PHOTO_CHECK_STATE={
  create(onChange=()=>{}){
    let generation=0;
    const advance=()=>{generation++;onChange(generation);return generation;};
    return Object.freeze({begin:advance,invalidate:advance,isCurrent(value){return value===generation;}});
  }
};
