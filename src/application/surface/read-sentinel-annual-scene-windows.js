"use strict";

/* Load annual evidence assets in legacy order, then read SCL before spectra. */
window.DG_READ_SENTINEL_ANNUAL_SCENE_WINDOWS={
  async read({scene,token,bbox,loadBands,readBands,signHref,openRaster,readBand}){
    const images=await loadBands.load({scene,token,bands:["B03","B04","B08","B11","SCL"],signHref,openRaster,missing:"skip"});
    if(!images)return null;
    return readBands.read({images,bands:["SCL","B03","B04","B08","B11"],bbox,readBand});
  }
};
