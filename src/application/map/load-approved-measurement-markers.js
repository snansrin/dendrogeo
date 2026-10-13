"use strict";

window.DG_LOAD_APPROVED_MEASUREMENT_MARKERS={
  async load({map,limit,done,readRows,prepare,draw,log}){
    if(!map){done&&done(-1,[],"Harita henüz kurulmadı (initMaps çağrılmadı)");return;}
    try{
      const{data}=await readRows();
      const rows=prepare(data);
      draw(map,rows);
      done&&done(rows.length,rows,null);
    }catch(error){
      const message=(error&&(error.message||error))+"";
      log.error("DENDROGEO · onaylı işaretçiler yüklenemedi:",message);
      done&&done(-1,[],message);
    }
  }
};
