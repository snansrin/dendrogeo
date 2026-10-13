"use strict";

/* Compose the surface-review partition use case with its area reconciler. */
window.DG_BUILD_SURFACE_REVIEW_SUMMARY={
  build({base,cells,classFor,geometries,features,epsg,park},{resolveParts,summarizeParts}){
    return summarizeParts(base,resolveParts(cells,classFor,geometries,features,epsg,park));
  }
};
