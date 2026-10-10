"use strict";

/* Resolve the reviewed surface first, then fall back to the latest analysis. */
async function dgPrepareGridSurfaceParts(options) {
  const {
    review,
    lastCells,
    outer,
    holes,
    epsg,
    osmElements,
    resolveReviewParts,
    prepare
  } = options;

  if (review?.record && review.geometry) {
    return resolveReviewParts();
  }

  if (lastCells?.length) {
    const prepared = await prepare({
      cells: lastCells,
      outer,
      holes,
      epsg,
      objects: null,
      elements: osmElements,
      features: []
    });
    return prepared.parts;
  }

  return [];
}

window.DG_GRID_SURFACE_PARTS = Object.freeze({ prepare: dgPrepareGridSurfaceParts });
