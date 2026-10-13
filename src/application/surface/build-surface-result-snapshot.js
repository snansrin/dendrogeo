"use strict";

/* Validate area conservation and build the exact-geometry publication snapshot. */
window.DG_BUILD_SURFACE_RESULT_SNAPSHOT={
  async build({record,epsg,cells,outer,holes,parts,parkGeometry,visualResult,mergeSync,displaySync,editSummary,translate}){
    const totals={};for(const part of parts)totals[part.type]=(totals[part.type]||0)+part.areaM2;
    for(const [key,area] of Object.entries(record.acceptedAreas))if(Math.abs(area-(totals[key]||0))>Math.max(.1,area*.00001))throw Error(translate("Analiz tüm parkı kapsamıyor. Parkı yeniden analiz edip tekrar kaydedin."));
    const job=await visualResult(parts),features=job?job.features:mergeSync(parts,epsg),displayFeatures=job?.displayFeatures||displaySync(parts,epsg,parkGeometry,features);
    return{schema:"dendrogeo-surface/2",parkId:record.parkId,acceptedAt:record.acceptedAt,fingerprint:record.fingerprint,epsg,cellCount:cells.length,areas:record.acceptedAreas,outer,holes,scenes:record.profile?.scenes||[],features,displayFeatures,editSummary:editSummary(record),displayMethod:{name:"exact-geometry",version:4,tolerance_m:0},displayNote:"Harita, kesin kabul geometrisini gösterir; görsel yumuşatma uygulanmaz."};
  }
};
