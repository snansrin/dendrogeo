"use strict";

window.DG_MARK_WAYPOINT_VISITED={
  async mark({client,id}){return await client.from("waypoints").update({visited:true}).eq("id",id);},
  async moveWaypoint({client,change}){
    for(const pointId of new Set([change.oldWpId,change.wpId])){
      const evidence=await client.from("measurements").select("id").eq("project_id",change.projectId).eq("point_id",pointId).limit(1).maybeSingle();
      if(evidence.error)throw evidence.error;
      if(evidence.data?.id)throw Error("Ölçüm geçmişi bulunan noktanın numarası sabittir.");
    }
    const result=await client.from("waypoints").update({wp_id:change.wpId,lat:change.lat,lon:change.lon})
      .eq("id",change.id).eq("project_id",change.projectId).eq("wp_id",change.oldWpId).select("id").maybeSingle();
    if(result.error)throw result.error;
    if(!result.data?.id)throw Error("Nokta değişmiş, silinmiş veya proje kilitlenmiş olabilir. Listeyi yeniden yükleyin.");
    return result.data;
  },
  async addWaypoint({client,owner,projectId,wpId,lat,lon}){
    if(!owner||!Number.isSafeInteger(projectId)||projectId<1||!Number.isSafeInteger(wpId)||wpId<1||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error("Nokta konumu veya proje kimliği geçersiz.");
    const history=await client.from("measurements").select("point_id").eq("project_id",projectId).order("point_id",{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
    if(history.error)throw history.error;
    const next=Math.max(wpId,(Number(history.data?.point_id)||0)+1);
    if(!Number.isSafeInteger(next))throw Error("Yeni nokta numarası üretilemedi.");
    const {data,error}=await client.from("waypoints").insert({owner,project_id:projectId,wp_id:next,lat,lon})
      .select("id,owner,project_id,wp_id,lat,lon,visited").single();
    if(error)throw error;if(!data?.id)throw Error("Nokta kaydedilemedi. Listeyi yenileyin.");
    return {...data,visited:false,hasMeasurement:false};
  }
};
