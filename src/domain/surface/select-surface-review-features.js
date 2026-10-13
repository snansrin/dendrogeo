"use strict";

/* Keep only review overlays with a declared surface class. */
window.DG_SELECT_SURFACE_REVIEW_FEATURES={
  select(features,types){return(features||[]).filter(feature=>types[feature.type]);}
};
