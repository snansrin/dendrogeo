"use strict";
/* Route preflight and creation outcomes while keeping the existing messages. */
(function(root){
 function createController({getContext,resolveReadiness,create,complete,translate,notify}){
  return async function run(mode){
   const {source,park}=getContext();
   const readiness=resolveReadiness(mode,source);
  if(!readiness.ok){
    if(readiness.reason==="surface-stale")return notify(translate("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");
    const messages={
      "grid-missing":"Önce grid oluştur",
      "project-missing":"Önce proje seç",
      "manual-selection-missing":"Önce hücre seçin",
      "target-cells-missing":"Uygun hücre yok"
    };
    return notify(messages[readiness.reason]);
  }

  const pid=readiness.projectId;
  const result=await create({source,park,projectId:pid,targetCells:readiness.targetCells});
  if(result.status==="cancelled")return;
  if(result.status==="stale")return notify(translate("Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun."),"warn");
  if(result.status==="write-failed")return notify("Hata: "+result.error.message,"err");
  return complete(result,pid);
  };
 }
 root.DG_GRID_WAYPOINT_CONTROLLER_UI=Object.freeze({create:createController});
})(window);
