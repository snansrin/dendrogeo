"use strict";

/* Refresh project park_name values so the database trigger recomposes names. */
window.DG_SYNC_PARK_PROJECT_NAMES_ADAPTER={
  create({getClient}){
    return async function sync(parkId,knownName){
      const client=getClient();
      let name=knownName?String(knownName).trim():"";
      if(!name){
        const{data}=await client.from("parks").select("name").eq("id",parkId).maybeSingle();
        name=(data&&data[0]&&data[0].name)||"";
      }
      if(!name)return;
      await client.from("projects").update({park_name:name}).eq("park_id",parkId);
    };
  }
};
