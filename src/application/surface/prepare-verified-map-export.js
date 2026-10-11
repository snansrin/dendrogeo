"use strict";
/* Read-only publication gate for the verified park map export. */
(function(root){
 function prepare({record,hasPark,vegetationView,rawView,getTiers}){
  if(!record||!hasPark)return{ok:false,type:"warn",message:"Önce parkın arazi örtüsü analizini açın."};
  if(!vegetationView||rawView)return{ok:false,type:"warn",message:"Göreli NDVI görünümü açık değil."};
  if(typeof getTiers!=="function")return{ok:false,type:"warn",message:"Göreli NDVI sınıfları bu oturumda bulunamadı."};
  const tiers=getTiers();
  if(tiers.count<9||!tiers.cutoffs)return{ok:false,type:"warn",message:"Doğrulanmış harita için yeterli NDVI verisi bulunamadı; en az 9 uygun yeşil hücre ve hücre başına 3 gözlem gerekir."};
  return{ok:true,tiers};
 }
 root.DG_PREPARE_VERIFIED_MAP_EXPORT=Object.freeze({prepare});
})(window);
