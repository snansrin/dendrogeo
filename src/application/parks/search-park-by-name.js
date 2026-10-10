"use strict";
/* Resolve a park by name locally first, then geocode an OSM search query. */
(function(root){
  function create({normalizeName,findRegistered,geocode,onEvent}){
    return async function searchPark(name){
      const query=String(name||"").trim();
      if(!query)return{status:"empty-query"};
      const normalized=normalizeName(query).toLocaleLowerCase("tr-TR");
      try{
        const parks=await findRegistered(normalized);
        if(parks&&parks.length)return{status:"registered",park:parks[0]};
      }catch(error){onEvent("database-error",error);}
      onEvent("searching-osm",query);
      try{
        const point=await geocode(query+" park");
        if(!point)return{status:"not-found",query};
        return{status:"geocoded",point};
      }catch(error){return{status:"geocode-failed",query,error};}
    };
  }
  root.DG_PARK_SEARCH_APPLICATION=Object.freeze({create});
})(window);
