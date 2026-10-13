"use strict";
/* Sanitize persisted fields and reject stale or internally inconsistent accepted results. */
(function(root){
 function normalize({fresh,source,revision,classes,validFeature}){
  const safe=source||fresh,sens={...fresh.sens};
  for(const key of classes){const value=Number(safe.sens?.[key]);sens[key]=Number.isFinite(value)?Math.max(0,Math.min(100,value)):50;}
  const record={...fresh,...safe,serverRevision:revision,sens,corrections:safe.corrections&&typeof safe.corrections==="object"&&!Array.isArray(safe.corrections)?safe.corrections:{},features:Array.isArray(safe.features)?safe.features.filter(validFeature):[]};
  const accepted=record.acceptedResult,areas=record.acceptedAreas,acceptedAreas=accepted?.areas;
  const invalidAccepted=!!(accepted&&(!areas||accepted.schema!=="dendrogeo-surface/2"||String(accepted.parkId)!==String(record.parkId)||accepted.fingerprint!==record.fingerprint||!Array.isArray(accepted.features)||!Array.isArray(accepted.displayFeatures)||!acceptedAreas||Object.keys({...areas,...acceptedAreas}).some(key=>Math.abs(Number(areas[key]||0)-Number(acceptedAreas[key]||0))>Math.max(.1,Math.abs(Number(areas[key]||0))*.00001))));
  if(invalidAccepted){record.acceptedResult=null;record.draftDirty=true;}
  return{record,invalidAccepted};
 }
 root.DG_NORMALIZE_SURFACE_REVIEW_RECORD=Object.freeze({normalize});
})(window);
