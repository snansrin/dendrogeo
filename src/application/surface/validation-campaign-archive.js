"use strict";

/* Keep the validation campaign archive API independent of its storage adapter. */
window.DG_VALIDATION_CAMPAIGN_ARCHIVE={
  create({store}){
    return Object.freeze({saveCampaign:campaign=>store.save(campaign),loadCampaigns:parkId=>store.load(parkId),deleteCampaign:id=>store.remove(id)});
  }
};
