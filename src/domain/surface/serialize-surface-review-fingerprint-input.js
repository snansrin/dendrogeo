"use strict";

/* Preserve the exact JSON representation used by existing surface fingerprints. */
window.DG_SERIALIZE_SURFACE_REVIEW_FINGERPRINT_INPUT={
  serialize(payload){return JSON.stringify(payload);}
};
