"use strict";

/* Adapt serialized fingerprint input to UTF-8 bytes. */
window.DG_ENCODE_SURFACE_REVIEW_FINGERPRINT_INPUT={
  encode(input,{TextEncoder}){return new TextEncoder().encode(input);}
};
