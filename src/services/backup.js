"use strict";
/* DendroGeo · services/backup.js — TAM YEDEK + HATIRLATICI (Faz 6)
 * admin.js'ten birebir taşındı: fetchAllRows (sayfalı tam döküm),
 * fullBackup (JSON indirme), checkBackupReminder (7 gün uyarısı). */

/* ============ TAM YEDEK (JSON) — Tez verisi sigortası ============ */
async function fetchAllRows(table, orderCol){
  let out=[], from=0, step=1000;
  for(;;){
    const {data,error}=await sb.from(table).select("*").order(orderCol).range(from, from+step-1);
    if(error) throw new Error(table+": "+error.message);
    out=out.concat(data||[]);
    if(!data||data.length<step) break;
    from+=step;
  }
  return out;
}

async function fullBackup(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner")) return toast("Yetki yok.","err");
  toast("Yedek hazırlanıyor…","info","💾");
  try{
    const meas = await fetchAllRows("measurements","created_at");
    const projs = await fetchAllRows("projects","id");
    const wps = await fetchAllRows("waypoints","id");
    let reqs = [];
    try{ reqs = await fetchAllRows("data_requests","created_at"); }catch(e){ reqs = []; }
    const backup={
      app:"DendroGeo",
      schema_version:"1.0.0",
      doi:"10.5281/zenodo.22646300",
      exported_at:new Date().toISOString(),
      exported_by:(PROFILE&&PROFILE.full_name)||"",
      counts:{measurements:meas.length,projects:projs.length,waypoints:wps.length,data_requests:reqs.length},
      measurements:meas,
      projects:projs,
      waypoints:wps,
      data_requests:reqs
    };
    const name="dendrogeo_yedek_"+new Date().toISOString().slice(0,10)+".json";
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    localStorage.setItem("dg_lastBackup", new Date().toISOString());
    toast("✓ Yedek indirildi: "+name+" ("+meas.length+" ölçüm)","ok","💾");
  }catch(e){
    toast("Yedek hatası: "+e.message,"err","❌");
  }
}

function checkBackupReminder(){
  const last=localStorage.getItem("dg_lastBackup");
  const days=last?(Date.now()-new Date(last).getTime())/86400000:999;
  if(days>7) toast("⚠ Son tam yedeğin üzerinden "+Math.floor(days)+" gün geçti — bugünkü yedeği alın","warn","💾");
}
