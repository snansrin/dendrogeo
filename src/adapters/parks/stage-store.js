"use strict";
/* Bounded, parent-specific reads and explicit stage creation; never near-match. */
(function(root){
 function create(getClient){
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  return Object.freeze({
   async ready(){const {data,error}=await getClient().rpc("dg_park_stage_ready");return !error&&data===1;},
   async deleteReady(){const {data,error}=await getClient().rpc("dg_park_stage_delete_ready");return !error&&data===1;},
   async remove(row){if(!row?.id||!/^stage\/\d+\/[a-f0-9]{32}$/.test(row.osm_key||""))throw Error("Silmek için bir etap seçin.");const {data,error}=await getClient().rpc("dg_delete_empty_park_stage",{p_stage:Number(row.id),p_key:row.osm_key});if(error){if(String(error.message).includes("STAGE_HAS_RECORDS"))throw Error("Bu etaba bağlı proje, ölçüm veya rapor var. Kayıtları korumak için silinmedi.");throw error;}if(Number(data)!==Number(row.id))throw Error("Etap silme doğrulanamadı.");return Number(data);},
   async list(parentId){
    if(!Number.isSafeInteger(Number(parentId))||Number(parentId)<=0)throw Error("Park kimliği geçersiz.");
    const {data,error}=await getClient().from("parks").select("id,osm_key,name,source,geom_json,area_m2,centroid_lat,centroid_lon,created_by").like("osm_key","stage/"+Number(parentId)+"/%").order("id").limit(100);
    if(error)throw error;return data||[];
   },
   async create(parentId,name,geometry){
    const {data,error}=await getClient().rpc("dg_create_park_stage",{p_parent:Number(parentId),p_name:name,p_geometry:geometry});
    if(error)throw error;return data;
   },
   async resolve(candidate){
    const row=candidate?.stageRow;
    if(!row?.id||!String(row.osm_key||"").startsWith("stage/"))throw Error("Etap kimliği eksik.");
    const {data,error}=await getClient().from("parks").select("*").eq("id",row.id).eq("osm_key",row.osm_key).single();
    if(error)throw error;
    if(!data)throw Error("Etap kaydı bulunamadı.");
    if(!same(data.geom_json,row.geom_json))throw Error("Etap sınırı değişmiş; yeniden seçin.");
    if(!same(candidate.rings,{outer:data.geom_json.outer,inner:data.geom_json.inner||[]}))throw Error("Etap çizimi kayıtla eşleşmiyor.");
    return data;
   }
  });
 }
 root.DG_PARK_STAGE_STORE=Object.freeze({create});
})(window);
