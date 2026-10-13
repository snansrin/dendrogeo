"use strict";

/* Build the stable, lowercase hexadecimal fingerprint for a reviewed surface. */
window.DG_BUILD_SURFACE_REVIEW_FINGERPRINT={
  async fingerprint(cells,outer,holes,meta,{select,serialize,encode,digest,TextEncoder,crypto}){
    const payload=select(cells,outer,holes,meta),input=serialize(payload),bytes=encode(input,{TextEncoder}),hash=await digest(bytes,{crypto});
    return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
  }
};
