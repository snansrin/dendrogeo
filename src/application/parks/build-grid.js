"use strict";
/* Prepare grid cells and measurement counts, rejecting outdated asynchronous results. */
(function(root){
 function create({ensureSurface,isCurrent,getGreenOnly,getLastCells,getReview,getSignature,resolveEpsg,prepareParts,buildRequest,runWorker,runGrid,resolveBounds,fetchMeasurements,warnTruncated,countMeasurements}){
  return async function buildParkGrid(context){
   const {park,size,clearance}=context;
   await ensureSurface();
   if(!isCurrent(context))return{status:"stale"};
   if(getGreenOnly()&&!getLastCells()?.length)throw Error("Önce yüzey analizi yapın; grid güncel yeşil alanı kullanır.");
   const review=getReview();
   if(review?.busy||review?.saving)throw Error("Yüzey işleminin tamamlanmasını bekleyin.");
   const signature=getSignature(),epsg=resolveEpsg(park),lastCells=getLastCells();
   const parts=await prepareParts({park,review,epsg,lastCells});
   const request=buildRequest({park,size,clearance,epsg,parts});
   const result=await runWorker(request)||await runGrid(request);
   if(!isCurrent(context))return{status:"stale"};
   if(signature!==getSignature())throw Error("Yüzey değişti. Güncel yüzeyle gridi tekrar oluşturun.");
   const {data,count,error}=await fetchMeasurements(resolveBounds(park));
   if(error)throw error;
   if(!isCurrent(context))return{status:"stale"};
   warnTruncated(data,count);
   countMeasurements(result,data,{size,epsg});
   if(signature!==getSignature())throw Error("Yüzey değişti. Güncel yüzeyle gridi tekrar oluşturun.");
   return{status:"ready",result,signature,review};
  };
 }
 root.DG_GRID_BUILD_APPLICATION=Object.freeze({create});
})(window);
