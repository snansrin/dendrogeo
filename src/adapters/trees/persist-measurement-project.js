"use strict";

/* Preserve the existing Supabase write shape and RLS-owned authorization. */
window.DG_PERSIST_MEASUREMENT_PROJECT={
  async lockStatus({client,id}){return client.from("projects").select("id,name,is_locked").eq("id",id).single();},
  async setLock({client,id,locked}){return client.from("projects").update({is_locked:locked}).eq("id",id).eq("is_locked",!locked).select("id,is_locked").maybeSingle();},
  async persist({client,command}){
    if(command.kind==="update")return client.from("projects").update(command.payload).eq("id",command.id);
    if(command.kind==="insert")return client.from("projects").insert(command.payload);
    throw new TypeError("unsupported project write command");
  }
};
