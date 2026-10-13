"use strict";

/* Read the scene's SCL mask first, then its requested reflectance bands. */
window.DG_READ_SENTINEL_SCENE_WINDOWS={
  async read({images,bands,bbox,readBand}){
    const windows={};
    for(const band of bands)windows[band]=await readBand(images[band],bbox);
    return windows;
  }
};
