"use strict";
/* Narrow, RLS-enforced reads. Opening a saved project must never upsert it. */
(function(root){
 const parkFields="id,name,osm_key,osm_type,osm_id,source,area_m2,centroid_lat,centroid_lon,geom_json,created_by";
 async function one(query,missing){
  const {data,error}=await query.maybeSingle();
  if(error)throw error;
  if(!data)throw Error(missing);
  return data;
 }
 async function optionalPark(client,id){
  const {data,error}=await client.from("parks")
   .select(parkFields)
   .eq("id",id).maybeSingle();
  if(error)throw error;
  return data||null;
 }
 async function parkByKey(client,key){
  // A replaced OSM parent may have a new database ID. Never guess by name,
  // position, or a stage key: only an exact canonical OSM identity may match.
  if(typeof key!=="string"||!/^(?:node|way|relation)\/[1-9]\d*$/.test(key))return null;
  const {data,error}=await client.from("parks").select(parkFields).eq("osm_key",key).maybeSingle();
  if(error)throw error;
  return data||null;
 }
 function create(client){
  return Object.freeze({
   project:id=>one(client.from("projects").select("id,name,park_id,is_locked").eq("id",id),"Proje bulunamadı veya erişim izni kaldırıldı."),
   async park(id){const row=await optionalPark(client,id);if(!row)throw Error("Kayıtlı park veya etap bulunamadı.");return row;},
   parent:id=>optionalPark(client,id),
   parentByKey:key=>parkByKey(client,key),
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
