"use strict";

/* Flatten cleaned overlay operands to the projected points used for a local origin. */
window.DG_COLLECT_SURFACE_REVIEW_CLIP_POINTS={
  collect(geometries){return geometries.flat(3);}
};
