"use strict";
/* Account snapshot is authoritative unless a newer local draft is explicitly dirty. */
(function(root){
 function select({fresh,local,remote}){
  const newerLocalDraft=!!(local?.draftDirty&&(!remote||String(local.modifiedAt||"")>String(remote.modifiedAt||"")));
  const chosen=newerLocalDraft?local:remote||local||fresh;
  let safe=chosen.owner===fresh.owner&&String(chosen.parkId)===String(fresh.parkId)?chosen:fresh;
  /* Account snapshots omit the large, reproducible per-cell spectral map.
   * Reuse a matching on-device copy without allowing stale evidence to cross
   * a park/raster fingerprint change. Other devices can run a fresh scan. */
  if(safe===remote&&local?.profile?.cells&&local.fingerprint===remote?.fingerprint){
   safe={...safe,profile:local.profile};
  }
  return{record:safe,newerLocalDraft};
 }
 root.DG_SELECT_SURFACE_REVIEW_SOURCE=Object.freeze({select});
})(window);
