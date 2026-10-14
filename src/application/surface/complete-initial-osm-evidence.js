"use strict";
/* A late mount job cannot publish status or a save completion to a newer park. */
window.DG_COMPLETE_INITIAL_OSM_EVIDENCE={async complete({record,epoch,load,isCurrent,isBusy,setStatus,translate,save,updateStatus}){
 const count=await load(record,epoch,true);if(!isCurrent(record,epoch)||isBusy())return;
 if(count||record.osmCoverage?.changed){setStatus(translate("OSM bina, yol ve su geometrileri önizlemeye uygulandı. Ham raster korunuyor; sınırları doğrulayıp sonucu kabul edin."));await save();}
 else if(record.osmCoverage?.status!=="complete"&&!(record.objectFeatures||[]).some(f=>f.type==="water"||f.type==="pool"))setStatus(translate("OSM su geometrisine erişilemedi. Bu 10 m raster önizlemesidir; kıyı sınırını doğrulanmış kabul etmeyin. Yeniden Tara'yı deneyin."));
 if(isCurrent(record,epoch))updateStatus();
}};
