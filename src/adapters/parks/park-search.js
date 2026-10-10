"use strict";
/* Supabase and Nominatim adapters used by remote park-name search. */
(function(root){
  function create({getClient,getFetch}){
    async function findRegistered(namePrefix){
      const{data}=await getClient().from("parks").select("*").ilike("name_norm",namePrefix+"%").order("name").limit(5);
      return data||[];
    }
    async function geocode(query){
      const response=await getFetch()("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(query));
      const rows=await response.json();
      return rows&&rows.length?{lat:+rows[0].lat,lon:+rows[0].lon}:null;
    }
    return Object.freeze({findRegistered,geocode});
  }
  root.DG_PARK_SEARCH_ADAPTER=Object.freeze({create});
})(window);
