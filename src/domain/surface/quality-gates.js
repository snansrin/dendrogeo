"use strict";
/* Pure surface-analysis quality rules. No map, network, state, or storage APIs. */
(function(root){
  function coverageDeltaPercent(assignedAreaM2,parkAreaM2){
    const assigned=Number(assignedAreaM2),park=Number(parkAreaM2);
    if(!(assigned>0))throw new Error("Park polygonu ile 10 m raster hücreleri kesişmiyor.");
    if(!(park>0))throw new Error("Park alanı geçersiz.");
    return Math.abs(assigned-park)/park*100;
  }
  function assertCoverage(assignedAreaM2,parkAreaM2,maxMismatchPercent=0.5){
    const deltaPct=coverageDeltaPercent(assignedAreaM2,parkAreaM2);
    if(deltaPct>maxMismatchPercent)throw new Error(
      "Raster/park alanı QA başarısız: "+deltaPct.toFixed(2)+"% fark. Kısmi alan zorla yeniden dağıtılmadı."
    );
    return deltaPct;
  }
  root.DG_SURFACE_QUALITY=Object.freeze({coverageDeltaPercent,assertCoverage});
})(window);
