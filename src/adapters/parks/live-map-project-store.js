"use strict";
/* Narrow, RLS-enforced reads. Opening a saved project must never upsert it. */
(function(root){
 async function one(query,missing){
  const {data,error}=await query.maybeSingle();
  if(error)throw error;
  if(!data)throw Error(missing);
  return data;
 }
 function create(client){
  return Object.freeze({
   project:id=>one(client.from("projects").select("id,name,park_id,is_locked").eq("id",id),"Proje bulunamadı veya erişim izni kaldırıldı."),
   park:id=>one(client.from("parks").select("id,name,osm_key,osm_type,osm_id,source,area_m2,centroid_lat,centroid_lon,geom_json").eq("id",id),"Kayıtlı park veya etap bulunamadı."),
   async waypoints(id){
    const {data,error}=await root.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:id});
    if(error)throw error;
    if((data||[]).length>=1000)throw Error("Nokta sayısı sayfalama sınırına ulaştı; eksik liste gösterilmedi.");
    return data||[];
   }
  });
 }
 root.DG_LIVE_MAP_PROJECT_STORE=Object.freeze({create});
})(window);
