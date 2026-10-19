"use strict";

/* Finish mounting only for the current editor epoch; launch optional water discovery. */
window.DG_FINISH_SURFACE_REVIEW_MOUNT={
  async finish({record,epoch,isCurrent,repartition,canRenderAccepted,renderAccepted,hidePending,scrollHost,autoWater}){
    const partitioned=await repartition();
    if(!isCurrent(record,epoch)||!partitioned)return false;
    if(record.acceptedResult&&canRenderAccepted())renderAccepted();
    hidePending();scrollHost();
    if(record.useObjects!==false&&record.objectVersion!=="footprints-v6-road-width-policy")void autoWater(record,epoch);
    return true;
  }
};
