"use strict";
/* A saved project resumes its existing account/device review after raster
 * evidence has been recreated. Never accept, save or alter a surface here. */
(function(root){
 async function restore({parkId,currentParkId,saveExisting,scan,hasCells,currentRecordParkId,openSavedReview,savedRecord}){
  if(!Number.isSafeInteger(parkId)||parkId<=0)throw Error("Önce kayıtlı bir proje açın.");
  if(!await saveExisting())throw Error("Açık yüzey taslağı kaydedilemedi. Yeni tarama başlatılmadı.");
  await scan();
  // Do not show another park's review if a selection changed mid-scan, and
  // never interpret a failed scan as sufficient evidence for old decisions.
  if(currentParkId()!==parkId||!hasCells()||currentRecordParkId()!==parkId)return {ready:false,restored:false};
  await openSavedReview(); // default review loading prefers the saved source
  const ready=currentParkId()===parkId&&currentRecordParkId()===parkId;
  const record=ready?savedRecord():null;
  // The brand-new scan record is not evidence of an older saved revision.
  return {ready,restored:!!(record&&(record.serverRevision||record.acceptedAt||record.draftSavedAt||record.modifiedAt))};
 }
 root.DG_LIVE_MAP_PROJECT_SURFACE_UI=Object.freeze({restore});
})(window);
