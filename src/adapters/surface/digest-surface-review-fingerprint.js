"use strict";

/* Hash fingerprint bytes with the browser's SubtleCrypto SHA-256 implementation. */
window.DG_DIGEST_SURFACE_REVIEW_FINGERPRINT={
  async digest(bytes,{crypto}){return crypto.subtle.digest("SHA-256",bytes);}
};
