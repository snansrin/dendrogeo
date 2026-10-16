"use strict";

/* Keep the existing owner-filtered update and insert request shapes intact. */
window.DG_PERSIST_QUEUED_MEASUREMENT={
  async save({client,payload,editId,owner,baseline}){
    if(!editId)return client.from("measurements").insert(payload).select("id");
    if(!baseline||String(baseline.id)!==String(editId)||String(baseline.owner)!==String(owner))throw new Error("Güvenli düzenleme için başlangıç kaydı gerekli.");
    const fields=Object.entries(baseline);
    if(fields.some(([key,value])=>! /^[a-z][a-z0-9_]*$/.test(key)||(value!==null&&!['string','number','boolean'].includes(typeof value))))throw new Error("Başlangıç kaydının alanları doğrulanamadı.");
    // PostgREST applies these predicates and the owner/RLS gate in ONE UPDATE.
    let query=client.from("measurements").update(payload).eq("id",editId).eq("owner",owner);
    for(const[key,value]of fields){if(key==="id"||key==="owner")continue;query=value===null?query.is(key,null):query.eq(key,value);}
    return query.select("id");
  }
};
