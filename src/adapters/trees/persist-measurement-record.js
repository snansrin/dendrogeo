"use strict";

/* Preserve the existing measurement insert/update and old-column retry shape. */
window.DG_PERSIST_MEASUREMENT_RECORD={
  async persist({client,record,editId}){
    if(editId){const{error}=await client.from("measurements").update(record).eq("id",editId);return{error};}
    let{error}=await client.from("measurements").insert(record);
    if(error){delete record.altitude_m;delete record.photo_file;({error}=await client.from("measurements").insert(record));}
    return{error};
  }
};
