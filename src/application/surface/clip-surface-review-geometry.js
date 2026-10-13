"use strict";

/* Clean, locally translate, clip, and restore review geometry with legacy errors. */
window.DG_CLIP_SURFACE_REVIEW_GEOMETRY={
  clip(operation,geometries,{clean,collectPoints,findOrigin,translate,clipper}){
    if(!clipper.has(operation))throw Error("Sınır hesaplama modülü yüklenmedi.");
    const input=geometries.map(clean),points=collectPoints(input);
    if(!points.length)return[];
    const [originX,originY]=findOrigin(points),local=input.map(geometry=>translate(geometry,-originX,-originY));
    try{return translate(clean(clipper.run(operation,...local)),originX,originY);}
    catch(error){if(!/Unable to find segment|SweepLine tree|Unable to complete output ring/i.test(String(error?.message||error)))throw error;throw Error("Sınır geometrisi sayısal olarak kararsız; tarama güvenli biçimde durduruldu. Park sınırını veya çakışan OSM geometrisini düzeltip yeniden deneyin.");}
  }
};
