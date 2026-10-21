"use strict";

/* Upload rows sequentially, report partial progress, then refresh the current list. */
window.DG_UPLOAD_WAYPOINT_CSV={
  async upload({projectId,file,owner,parse,validate,build,upsert,notify,refresh,translate}){
    let saved=0,invalid=0;
    try{
      const rows=parse(await file.text());
      for(const cells of rows){
        const waypoint=validate(cells);
        if(!waypoint){invalid++;continue;}
        await upsert(build({owner,projectId,waypoint}));saved++;
      }
      notify("✓ "+saved+" ölçüm noktası kaydedildi."+(invalid?" "+invalid+" geçersiz satır atlandı.":""),invalid?"warn":"ok");
    }catch(error){notify(translate("Ölçüm noktası yükleme hatası:")+" "+error.message+" · "+saved+" satır kaydedildi.","err");}
    await refresh();
    return{saved,invalid};
  }
};
