"use strict";
/* Bounded read-only Nominatim transport for a known OSM way. */
(function(root){
  async function lookup(osmId,{signal,fetchImpl=root.fetch}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500),parentAbort=()=>controller.abort();
    if(signal?.aborted)controller.abort();else signal?.addEventListener("abort",parentAbort,{once:true});
    try{
      const url="https://nominatim.openstreetmap.org/lookup?osm_ids=W"+encodeURIComponent(osmId)+"&format=jsonv2&polygon_geojson=1";
      const response=await fetchImpl(url,{method:"GET",headers:{Accept:"application/json"},signal:controller.signal,cache:"no-store"});
      if(!response.ok)return null;
      return await response.json();
    }finally{clearTimeout(timer);signal?.removeEventListener("abort",parentAbort);}
  }
  root.DG_FETCH_NOMINATIM_OSM_WAY=Object.freeze({lookup});
})(window);
