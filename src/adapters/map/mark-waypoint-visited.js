"use strict";

window.DG_MARK_WAYPOINT_VISITED={
  async mark({client,id}){return await client.from("waypoints").update({visited:true}).eq("id",id);},
  async moveWaypoint({client,change}){
    if(Number(change.wpId)!==Number(change.oldWpId)){
      const evidence=await client.from("measurements").select("id").eq("project_id",change.projectId).eq("point_id",change.oldWpId).limit(1).maybeSingle();
      if(evidence.error)throw evidence.error;
      if(evidence.data?.id)throw Error("Ölçüm geçmişi bulunan noktanın numarası sabittir.");
    }
    const result=await client.from("waypoints").update({wp_id:change.wpId,lat:change.lat,lon:change.lon})
      .eq("id",change.id).eq("project_id",change.projectId).eq("wp_id",change.oldWpId).select("id").maybeSingle();
    if(result.error)throw result.error;
    if(!result.data?.id)throw Error("Nokta değişmiş, silinmiş veya proje kilitlenmiş olabilir. Listeyi yeniden yükleyin.");
    return result.data;
  }
};
