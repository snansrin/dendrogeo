"use strict";

/* Preserve the existing Supabase write shape and RLS-owned authorization. */
window.DG_PERSIST_MEASUREMENT_PROJECT={
  async persist({client,command}){
    if(command.kind==="update")return client.from("projects").update(command.payload).eq("id",command.id);
    if(command.kind==="insert")return client.from("projects").insert(command.payload);
    throw new TypeError("unsupported project write command");
  }
};
