"use strict";
/* Find the selected park's device draft, migrating a matching old unscoped id. */
(function(root){
 async function load({fresh,loadCampaigns,selectCampaign,fingerprint,cells,outer,holes,year,engine}){
  let local=null;
  try{
   const rows=await loadCampaigns(fresh.parkId);
   if(selectCampaign)local=selectCampaign.select(rows,fresh);
   else local=rows.find(record=>record.id===fresh.id&&record.owner===fresh.owner);
   if(!local&&fresh.parkId){
    const drafts=await loadCampaigns(null),sourceFingerprint=await fingerprint(cells,outer,holes,{year,engine});
    if(selectCampaign)local=selectCampaign.select(drafts,{...fresh,fingerprint:sourceFingerprint});
    else{const old=drafts.find(record=>record.id==="surface-"+fresh.owner+"-x"&&record.owner===fresh.owner&&record.fingerprint===sourceFingerprint);if(old)local={...old,id:fresh.id,parkId:fresh.parkId,parkName:fresh.parkName};}
   }
  }catch(error){/* Device drafts are optional; the account snapshot remains available. */}
  return local;
 }
 root.DG_LOAD_LOCAL_SURFACE_REVIEW_DRAFT=Object.freeze({load});
})(window);
