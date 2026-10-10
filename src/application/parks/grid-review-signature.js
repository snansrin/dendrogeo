"use strict";

/* Capture only the reviewed-surface fields that invalidate a built grid. */
function dgGridReviewSignature(state) {
  return state?.record
    ? JSON.stringify([
      state.epoch,
      state.partitionVersion,
      state.record.scannedAt,
      state.editing,
      state.record.sens,
      state.record.corrections,
      state.record.features,
      state.record.useObjects
    ])
    : null;
}

window.DG_GRID_REVIEW_SIGNATURE = Object.freeze({ resolve: dgGridReviewSignature });
