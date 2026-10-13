"use strict";

/* Select located roster rows and preserve the current map-fit decision. */
window.DG_PREPARE_LIVE_VISITOR_MAP_FRAME={
  prepare({rows,hasLocation,fit,follow}){
    const located=(rows||[]).filter(row=>hasLocation(row.p));
    return Object.freeze({located,shouldFit:!fit||!!follow});
  }
};
