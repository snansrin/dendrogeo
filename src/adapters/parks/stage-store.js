"use strict";
/* Bounded, parent-specific reads and explicit stage creation; never near-match. */
(function(root){
 function create(getClient){
  return Object.freeze({
   async ready(){const {data,error}=await getClient().rpc("dg_park_stage_ready");return !error&&data===1;},
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
    if(JSON.stringify(data.geom_json)!==JSON.stringify(row.geom_json))throw Error("Etap sınırı değişmiş; yeniden seçin.");
    if(JSON.stringify(candidate.rings)!==JSON.stringify({outer:data.geom_json.outer,inner:data.geom_json.inner||[]}))throw Error("Etap çizimi kayıtla eşleşmiyor.");
    return data;
   }
  });
 }
 root.DG_PARK_STAGE_STORE=Object.freeze({create});
})(window);
