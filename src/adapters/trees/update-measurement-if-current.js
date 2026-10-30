"use strict";

/* Atomic owner/RLS-scoped edit with comparisons limited to the columns that
 * this form can overwrite and to approval/deletion state. Comparing every
 * SELECT * metadata column caused false conflicts (e.g. activity timestamps).
 * Scientific values and actual concurrent edits still conflict atomically. */
window.DG_UPDATE_MEASUREMENT_IF_CURRENT={
  async update({client,payload,editId,owner,baseline}){
    if(!baseline||String(baseline.id)!==String(editId)||String(baseline.owner)!==String(owner))
      throw new Error("Güvenli düzenleme için başlangıç kaydı gerekli.");
    if(payload.owner!=null&&String(payload.owner)!==String(owner))
      throw new Error("Kayıt sahibi düzenleme sırasında değiştirilemez.");
    const updates={...payload};delete updates.id;
    const guard=new Set([
      "project_id","point_id","measurement_no","grp","species",
      "girth_cm","dbh_cm","height_m","volume_m3","carbon_kg",
      "slope_deg","shared","status","park_id","deleted_at"
    ]);
    // Guard extra photo fields only when the edit actually overwrites them.
    for(const key of ["photo_url","photo_file"])if(Object.hasOwn(updates,key))guard.add(key);
    const fields=Object.entries(baseline).filter(([key])=>guard.has(key));
    if(fields.some(([key,value])=>! /^[a-z][a-z0-9_]*$/.test(key)||
      (value!==null&&!["string","number","boolean"].includes(typeof value))))
      throw new Error("Başlangıç kaydının alanları doğrulanamadı.");
    let query=client.from("measurements").update(updates).eq("id",editId).eq("owner",owner);
    for(const [key,value] of fields){
      query=value===null?query.is(key,null):query.eq(key,value);
    }
    return query.select("id");
  }
};
