"use strict";

/* Upload rows sequentially, report partial progress, then refresh the current list. */
window.DG_UPLOAD_WAYPOINT_CSV={
  async upload({projectId,file,owner,parse,validate,build,upsert,notify,refresh,translate,existingWaypoints=[]}){
    let saved=0,invalid=0,protectedRows=0,unchanged=0,conflicts=0;
    try{
      const rows=parse(await file.text());
      const existing=new Map((Array.isArray(existingWaypoints)?existingWaypoints:[]).filter(row=>Number(row.project_id)===Number(projectId)).map(row=>[Number(row.wp_id),row]));
      const reserved=new Set(rows.filter(cells=>cells?.[3]!=="generated").map(cells=>Number(cells?.[2])).filter(id=>Number.isInteger(id)&&id>0));
      let maxExistingId=0;for(const id of existing.keys())if(id>maxExistingId)maxExistingId=id;
      let nextId=maxExistingId+1;
      const seen=new Set();
      for(const cells of rows){
        let waypoint=validate(cells);
        if(!waypoint){invalid++;continue;}
        if(waypoint.generated){while(existing.has(nextId)||reserved.has(nextId)||seen.has(nextId))nextId++;waypoint={...waypoint,id:nextId++};}
        if(seen.has(waypoint.id)){conflicts++;continue;}
        seen.add(waypoint.id);
        const current=existing.get(waypoint.id);
        if(current&&Number(current.lat)===waypoint.lat&&Number(current.lon)===waypoint.lon){unchanged++;continue;}
        if(current&&(current.hasMeasurement||current.visited)){protectedRows++;continue;}
        await upsert(build({owner,projectId,waypoint}));saved++;
      }
      const skipped=[invalid?invalid+" geçersiz":null,protectedRows?protectedRows+" ölçüm kaydı korundu":null,unchanged?unchanged+" zaten aynı":null,conflicts?conflicts+" yinelenen numara":null].filter(Boolean);
      notify("✓ "+saved+" ölçüm noktası kaydedildi."+(skipped.length?" "+skipped.join(", ")+" satır atlandı.":""),skipped.length?"warn":"ok");
    }catch(error){notify(translate("Ölçüm noktası yükleme hatası:")+" "+error.message+" · "+saved+" satır kaydedildi.","err");}
    await refresh();
    return{saved,invalid,protectedRows,unchanged,conflicts};
  }
};
