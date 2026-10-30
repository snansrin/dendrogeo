"use strict";

/* A measurement edit is a PATCH, not a complete INSERT-shaped rewrite.
 * The original server client_id is the atomic version token. It is rotated
 * by every edit, so comparing old floating-point scientific results (or
 * unrelated photo/park metadata) as SQL WHERE predicates is unnecessary and
 * broke legitimate edits of approved records. Keep owner/RLS, approval state,
 * deletion state and photo-replacement safety intact.
 *
 * This module neither computes nor changes allometry, wood densities, species
 * catalogs or any land-cover calculation. It only selects writable columns.
 */
window.DG_UPDATE_MEASUREMENT_IF_CURRENT={
  async update({client,payload,editId,owner,baseline}){
    if(!baseline||String(baseline.id)!==String(editId)||String(baseline.owner)!==String(owner))
      throw new Error("Güvenli düzenleme için başlangıç kaydı gerekli.");
    if(payload.owner!=null&&String(payload.owner)!==String(owner))
      throw new Error("Kayıt sahibi düzenleme sırasında değiştirilemez.");
    if(typeof baseline.client_id!=="string"||!baseline.client_id.trim())
      throw new Error("Kaydın başlangıç sürümü bulunamadı; kaydı yeniden açın.");
    if(typeof payload.client_id!=="string"||!payload.client_id.trim()||
       payload.client_id===baseline.client_id)
      throw new Error("Düzenleme için yeni bir kayıt sürümü oluşturulamadı.");
    if(baseline.deleted_at!=null)
      throw new Error("Silinmiş kayıt güncellenemez.");

    const changed=key=>Object.hasOwn(payload,key)&&
      (!Object.hasOwn(baseline,key)||payload[key]!==baseline[key]);
    const updates={client_id:payload.client_id};
    // An untouched input must never rewrite the recorded full-precision DBH.
    const girthChanged=changed("girth_cm");
    const heightChanged=changed("height_m");
    for(const key of ["project_id","point_id","measurement_no","grp","species","height_m","carbon_kg","status"])
      if(changed(key))updates[key]=payload[key];
    if(girthChanged){
      updates.girth_cm=payload.girth_cm;
      if(Object.hasOwn(payload,"dbh_cm"))updates.dbh_cm=payload.dbh_cm;
    }
    if((girthChanged||heightChanged)&&Object.hasOwn(payload,"volume_m3"))
      updates.volume_m3=payload.volume_m3;
    // Do not silently change the selected park or invoke geo-fence triggers
    // on a species-only edit. The project gate verifies real project changes.
    if(changed("project_id")&&Object.hasOwn(payload,"park_id"))
      updates.park_id=payload.park_id;
    // The upload stage adds photo fields only when the user supplies a photo.
    for(const key of ["photo_url","photo_file"])
      if(Object.hasOwn(payload,key))updates[key]=payload[key];

    let query=client.from("measurements").update(updates)
      .eq("id",editId).eq("owner",owner).eq("client_id",baseline.client_id);
    if(Object.hasOwn(baseline,"status"))
      query=baseline.status===null?query.is("status",null):query.eq("status",baseline.status);
    if(Object.hasOwn(baseline,"deleted_at"))
      query=baseline.deleted_at===null?query.is("deleted_at",null):query.eq("deleted_at",baseline.deleted_at);
    for(const key of ["photo_url","photo_file"]){
      if(!Object.hasOwn(updates,key)||!Object.hasOwn(baseline,key))continue;
      const old=baseline[key];
      query=old===null?query.is(key,null):query.eq(key,old);
    }
    return query.select("id");
  }
};
