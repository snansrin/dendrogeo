"use strict";

/* Select the owner's park record or migrate its matching legacy device draft. */
window.DG_SELECT_VALIDATION_CAMPAIGN={
  select(rows,{id,owner,parkId,parkName,fingerprint}){
    const campaigns=rows||[];
    const current=campaigns.find(campaign=>campaign.id===id&&campaign.owner===owner);
    if(current)return current;
    if(!parkId)return null;
    const legacy=campaigns.find(campaign=>campaign.id==="surface-"+owner+"-x"&&campaign.owner===owner&&campaign.fingerprint===fingerprint);
    return legacy?{...legacy,id,parkId,parkName}:null;
  }
};
