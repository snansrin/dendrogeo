"use strict";

/* Open one scene's required assets in declaration order, preserving failure policy. */
window.DG_LOAD_SENTINEL_SCENE_BANDS={
  async load({scene,token,bands,signHref,openRaster,missing="throw"}){
    const assets=scene.item.assets||{};
    const hrefFor=name=>assets[name]?.href?signHref(assets[name].href,token):null;
    const reads={};
    for(const band of bands){
      const href=hrefFor(band);
      if(!href){if(missing==="skip")return null;throw new Error(band+" asset'i yok");}
      reads[band]=Promise.resolve(openRaster(href)).then(tiff=>tiff.getImage());
    }
    const names=Object.keys(reads),loaded=await Promise.all(names.map(name=>reads[name]));
    return Object.fromEntries(names.map((name,index)=>[name,loaded[index]]));
  }
};
