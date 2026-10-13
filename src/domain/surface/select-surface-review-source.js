"use strict";
/* Account snapshot is authoritative unless a newer local draft is explicitly dirty. */
(function(root){
 function select({fresh,local,remote}){
  const newerLocalDraft=!!(local?.draftDirty&&(!remote||String(local.modifiedAt||"")>String(remote.modifiedAt||"")));
  const chosen=newerLocalDraft?local:remote||local||fresh;
  const safe=chosen.owner===fresh.owner&&String(chosen.parkId)===String(fresh.parkId)?chosen:fresh;
  return{record:safe,newerLocalDraft};
 }
 root.DG_SELECT_SURFACE_REVIEW_SOURCE=Object.freeze({select});
})(window);
