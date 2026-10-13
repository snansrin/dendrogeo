"use strict";

/* Keep polygon-clipping access behind a small operation adapter. */
window.DG_RUN_SURFACE_REVIEW_POLYGON_OPERATION={
  has(operation){const clipping=window.polygonClipping;return!!clipping&&typeof clipping[operation]==="function";},
  run(operation,...geometries){return window.polygonClipping[operation](...geometries);}
};
