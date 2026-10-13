"use strict";

/* Discard decisions tied to old source data while preserving unrelated record metadata. */
window.DG_RESET_SURFACE_REVIEW_DATA_CHANGE={
  reset(record){Object.assign(record,{corrections:{},features:[],objectFeatures:null,profile:null,acceptedAt:null,acceptedAreas:null,acceptedResult:null});return record;}
};
