"use strict";
/* Supabase adapter for accepted surface review snapshots. */
async function dgSurfaceReviewLoad(client,parkId,owner){
 const{data,error}=await client.from("surface_reviews").select("payload,revision,source_fingerprint").eq("park_id",parkId).eq("owner",owner).maybeSingle();
 if(error)throw error;
 return data;
}
async function dgSurfaceReviewSave(client,record,revision){
 const row={park_id:record.parkId,owner:record.owner,source_fingerprint:record.fingerprint,payload:record,revision:(revision||0)+1,updated_at:new Date().toISOString()};
 const query=revision?client.from("surface_reviews").update(row).eq("park_id",record.parkId).eq("owner",record.owner).eq("revision",revision):client.from("surface_reviews").insert(row);
 const{data,error}=await query.select("revision").maybeSingle();
 if(error)throw error;
 if(!data)throw Error("Kayıt başka cihazda değişti. Parkı yeniden açıp son kaydı yükleyin.");
 return data.revision;
}
window.DG_SURFACE_REVIEW_STORE=Object.freeze({load:dgSurfaceReviewLoad,save:dgSurfaceReviewSave});
