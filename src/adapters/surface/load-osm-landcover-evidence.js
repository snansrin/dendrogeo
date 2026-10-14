"use strict";
/* Share bounded OSM coverage and recover water evidence without widening scope. */
(function(root){
  function cached(bbox){
    const coverage=root.DG_SURFACE_OSM,b=coverage?.bbox;
    if(!b||!Array.isArray(coverage.elements)||Date.now()-Date.parse(coverage.fetchedAt)>600000||!Number.isFinite(Date.parse(coverage.fetchedAt)))return null;
    return b.minLat<=bbox.minLat&&b.minLon<=bbox.minLon&&b.maxLat>=bbox.maxLat&&b.maxLon>=bbox.maxLon?coverage:null;
  }
  async function load(bbox,{cache,boundary,isWaterElement,waterBackup,overpassRequest,fetchImpl}){
    const pending=root.DG_SURFACE_OSM_PENDING,detailedAlreadyAttempted=pending?.boundary===boundary;
    if(detailedAlreadyAttempted)await pending.promise.catch(()=>false);
    const coverage=cached(bbox);
    if(coverage?.elements?.some(isWaterElement)&&coverage.elements.some(el=>el.tags?.building&&el.tags.building!=="no")&&coverage.elements.some(el=>el.tags?.highway))return coverage;
    const bounds=[bbox.minLat,bbox.minLon,bbox.maxLat,bbox.maxLon].join(","),old=cache.get(bounds);
    if(old&&Date.now()-old.time<600000)return old.promise;
    const promise=(async()=>{
      const fallback=typeof waterBackup==="function"?await waterBackup(bbox).catch(()=>null):null;
      const seedElements=[...(coverage?.elements||[]),...(fallback?.elements||[])].filter((element,index,elements)=>elements.findIndex(other=>other.type===element.type&&String(other.id)===String(element.id))===index);
      /* A failed full-park query must not disable the smaller analysis-area
       * request: retry through the shared mirror queue so roads/buildings can
       * still refine the 10 m preview. */
      const query='[out:json][timeout:25];(nwr["natural"="water"]('+bounds+');nwr["waterway"="riverbank"]('+bounds+');nwr["leisure"="swimming_pool"]('+bounds+');nwr["landuse"~"reservoir|basin"]('+bounds+');nwr["building"]('+bounds+');nwr["building:part"]('+bounds+');way["highway"]('+bounds+');way["area:highway"]('+bounds+'););out geom;';
      if(typeof overpassRequest==="function"){
        const data=await overpassRequest(query,"su+yol").catch(()=>null);
        if(Array.isArray(data?.elements)){const result={elements:[...seedElements,...data.elements.filter(element=>!seedElements.some(old=>old.type===element.type&&String(old.id)===String(element.id)))],bbox,boundary,fetchedAt:new Date().toISOString()};if(boundary===JSON.stringify(typeof PARK_POLY==="undefined"?null:PARK_POLY))root.DG_SURFACE_OSM=result;return result;}
        return seedElements.length?{elements:seedElements,bbox,boundary,fetchedAt:coverage?.fetchedAt||new Date().toISOString(),source:coverage?.source||fallback?.source}:null;
      }
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{const response=await fetchImpl("https://lz4.overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:"data="+encodeURIComponent(query),signal:controller.signal});if(response.ok){const data=await response.json();if(Array.isArray(data?.elements)&&!data.remark){const result={...data,elements:[...seedElements,...data.elements.filter(element=>!seedElements.some(old=>old.type===element.type&&String(old.id)===String(element.id)))],bbox,boundary,fetchedAt:new Date().toISOString()};if(boundary===JSON.stringify(typeof PARK_POLY==="undefined"?null:PARK_POLY))root.DG_SURFACE_OSM=result;return result;}}}catch(error){}finally{clearTimeout(timer);}
      return seedElements.length?{elements:seedElements,bbox,boundary,fetchedAt:coverage?.fetchedAt||new Date().toISOString(),source:coverage?.source||fallback?.source}:null;
    })().catch(()=>null).then(data=>{if(!data)cache.delete(bounds);return data;});
    cache.set(bounds,{time:Date.now(),promise});return promise;
  }
  root.DG_LOAD_OSM_LANDCOVER_EVIDENCE=Object.freeze({cached,load});
})(window);
