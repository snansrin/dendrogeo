"use strict";
/* Supabase adapter for park identity lookup and insertion. */
(function(root){
  function create({client,normalizeLoose,distance}){
    async function selectByKey(key){
      try{
        const{data}=await client.from("parks").select("*").eq("osm_key",key).limit(1);
        return(data&&data[0])||null;
      }catch(_){return null;}
    }
    async function selectNear(nameNorm,lat,lon,radiusM){
      if(!Number.isFinite(+lat)||!Number.isFinite(+lon))return null;
      const loose=normalizeLoose(nameNorm);
      if(!loose)return null;
      const dLat=(+radiusM)/111000;
      const dLon=(+radiusM)/(111000*Math.max(.2,Math.cos(lat*Math.PI/180)));
      try{
        const{data}=await client.from("parks").select("*")
          .gte("centroid_lat",lat-dLat).lte("centroid_lat",lat+dLat)
          .gte("centroid_lon",lon-dLon).lte("centroid_lon",lon+dLon)
          .limit(50);
        const hits=(data||[]).filter(p=>normalizeLoose(p.name)===loose);
        if(!hits.length)return null;
        hits.sort((a,b)=>distance(lat,lon,+a.centroid_lat,+a.centroid_lon)-distance(lat,lon,+b.centroid_lat,+b.centroid_lon));
        const best=hits[0];
        return distance(lat,lon,+best.centroid_lat,+best.centroid_lon)<=radiusM?best:null;
      }catch(_){return null;}
    }
    async function insert(row){return await client.from("parks").insert(row).select().single();}
    return Object.freeze({selectByKey,selectNear,insert});
  }
  root.DG_PARK_STORE_ADAPTER=Object.freeze({create});
})(window);
