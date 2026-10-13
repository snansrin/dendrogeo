"use strict";

/* Apply an explicitly selected OSM object as a preview, preserving save and water-review gates. */
window.DG_APPLY_SURFACE_OBJECT_BOUNDARY={
  async run({apply,accept,isAccepted}){
    const applied=await apply();if(!applied)return false;
    const accepted=await accept();if(!accepted)return false;
    return isAccepted();
  },
  async apply(ports){
    const{preview,rawView,busy,saving,exporting,drawType,selectedType,types,record,areas,createFeature,validFeature,repartition,cancelPreview,setDrawType,renderTools,markDirty,getRecord,getAreas,needsWaterScan,save,setStatus,getStatus,updateStatus,toast,scan,translate,formatApplied,formatNoArea,formatScanning,formatScanFailed,summary}=ports;
    const type=types[drawType]?drawType:selectedType||preview?.type;
    if(!preview||rawView||busy||saving||exporting)return;
    if(!types[type]){setStatus(translate("Önce uygulanacak sınıfı seçin."));updateStatus();toast(getStatus(),"warn");return;}
    const current=record();if(!current)return;
    const before=areas()||{},feature=createFeature({type,geometry:preview.geometry,osmId:preview.osmId});
    if(!validFeature(feature)){setStatus(translate("Seçilen nesnenin geometrisi uygulanamadı; sınırı yeniden seçin."));updateStatus();toast(getStatus(),"warn");return;}
    setDrawType(type);renderTools();
    return repartition([...(current.features||[]),feature]).then(async ok=>{
      if(!ok||getRecord()!==current)return false;
      cancelPreview();markDirty();renderTools();const next= getAreas();if(!next)return;
      const delta=Number(next[type]||0)-Number(before[type]||0),label=translate(types[type].label);
      setStatus(delta>.01?formatApplied(label,delta.toFixed(1)):formatNoArea(label));
      const saved=await save();if(!saved)return false;
      if(type==="water"&&needsWaterScan()){
        setStatus(formatScanning());updateStatus();const scanned=await scan();
        if(!scanned){setStatus(formatScanFailed());updateStatus();return false;}
      }
      summary();updateStatus();toast(getStatus(),delta>.01?"info":"warn");return true;
    });
  }
};
