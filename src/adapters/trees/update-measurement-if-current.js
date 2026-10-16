"use strict";
/* One atomic owner/RLS-scoped UPDATE shared by online and queued edits. */
window.DG_UPDATE_MEASUREMENT_IF_CURRENT={
  async update({client,payload,editId,owner,baseline}){
    if(!baseline||String(baseline.id)!==String(editId)||String(baseline.owner)!==String(owner))throw new Error("Güvenli düzenleme için başlangıç kaydı gerekli.");
    const fields=Object.entries(baseline);
    if(fields.some(([key,value])=>! /^[a-z][a-z0-9_]*$/.test(key)||(value!==null&&!['string','number','boolean'].includes(typeof value))))throw new Error("Başlangıç kaydının alanları doğrulanamadı.");
    if(payload.owner!=null&&String(payload.owner)!==String(owner))throw new Error("Kayıt sahibi düzenleme sırasında değiştirilemez.");
    const updates={...payload};delete updates.id;
    // The primary key stays fixed; client_id identifies this write attempt.
    let query=client.from("measurements").update(updates).eq("id",editId).eq("owner",owner);
    for(const[key,value]of fields){if(key==="id"||key==="owner")continue;query=value===null?query.is(key,null):query.eq(key,value);}
    return query.select("id");
  }
};
