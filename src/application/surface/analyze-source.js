"use strict";
/* DendroGeo · application/surface/analyze-source.js
 * Coordinates one source scan across STAC discovery, SAS signing, parallel
 * tile work, cancellation, deduplication, and result aggregation. Ports are
 * supplied by the legacy service adapter; this use-case owns no GIS math.
 */
async function dgRunSurfaceSourceAnalysis(src,bbox,geometry,ports){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ports.timeoutMs||90000);
  try{
    /* STAC karo listesi ile SAS tokenı birbirinden bağımsızdır: aynı anda
     * istenmesi mobil bağlantıda gereksiz beklemeyi azaltır. */
    const [items,token]=await Promise.all([
      ports.findTiles(bbox,src,controller.signal),
      ports.getSas(src.collection,controller.signal)
    ]);

    if(items.length>ports.maxTiles){
      throw new Error("AOI çok sayıda 10 m veri karosuna taşıyor; analiz güvenliği nedeniyle durduruldu.");
    }

    const seen=new Set();
    const jobs=[];
    for(const item of items){
      if(seen.has(item.id))continue;
      seen.add(item.id);
      const asset=ports.getDataAsset(item,src);
      if(!asset?.href)throw new Error(src.year+" veri karosunun COG asset'i bulunamadı: "+item.id);
      const href=ports.signedHref(asset.href,token);
      jobs.push(ports.processTile(item,href,geometry,src,controller.signal));
    }
    /* Kesişen karolar bağımsızdır; seri GeoTIFF okuması yerine paralel
     * işlenir. Sonuçların birleştirilmesi deterministiktir. */
    const parts=await Promise.all(jobs);
    return{result:ports.mergeTileResults(parts),items:items.map(i=>i.id)};
  }catch(error){
    if(controller.signal.aborted)throw new Error(src.label+" veri okuması zaman aşımına uğradı; yeniden deneyin.");
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

window.DG_SURFACE_SOURCE_ANALYSIS=Object.freeze({run:dgRunSurfaceSourceAnalysis});
