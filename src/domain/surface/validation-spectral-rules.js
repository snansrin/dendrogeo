"use strict";
/* Threshold controls and deterministic Sentinel-2 class prediction rules. */
(function(root){
  function ibi(ndvi,mndwi,ndbi){const d1=ndbi+1,d2=ndvi+1,d3=mndwi+1;if(!d1||!d2||!d3)return null;return(2*ndbi)/d1-(ndvi/d2+mndwi/d3);}
  function thresholds(sens,{spectral:spec,sensitivity:K}){
    const clamp=value=>{if(value==null||value==="")return 50;const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;},green=clamp(sens&&sens.green),water=clamp(sens&&sens.water),hard=clamp(sens&&sens.hard),bare=clamp(sens&&sens.bare);
    return{ndviGreenMin:spec.NDVI_GREEN_MIN+(green-50)*K.greenNdvi,ndviYearGreenMin:spec.NDVI_MAX_GREEN+(green-50)*K.greenYear,mndwiWaterMin:spec.MNDWI_WATER_MIN+(water-50)*K.waterMndwi,mndwiYearWaterMin:spec.MNDWI_MAX_WATER+(water-50)*K.waterYear,ibiHardMin:spec.IBI_HARD_MIN+(hard-50)*K.hardIbi,ndviHardMin:spec.NDVI_HARD_MIN+(hard-50)*K.hardNdvi,ibiStrongMin:spec.IBI_BARE_MAX+(hard-50)*K.hardStrongIbi,ndviBareMax:spec.NDVI_BARE_MAX+(bare-50)*K.bareNdvi,canopyMax:spec.NDVI_WATERCANOPY_MAX,dryMax:spec.MNDWI_DRY_MAX,yearBareMin:spec.NDVI_YEAR_BARE_MIN};
  }
  function predict(m,sens,opts,{spectral:spec,thresholds:getThresholds,ibi:calcIbi}){
    if(!m)return"nodata";const obs=Number(m.obs)||0;if(obs<spec.MIN_OBS)return"nodata";const ndvi=Number(m.ndvi),mndwi=Number(m.mndwi),ndbi=Number(m.ndbi);if(!Number.isFinite(ndvi)||!Number.isFinite(mndwi)||!Number.isFinite(ndbi))return"nodata";
    const T=sens?getThresholds(sens):{ndviGreenMin:spec.NDVI_GREEN_MIN,ndviYearGreenMin:spec.NDVI_MAX_GREEN,mndwiWaterMin:spec.MNDWI_WATER_MIN,mndwiYearWaterMin:spec.MNDWI_MAX_WATER,ibiHardMin:spec.IBI_HARD_MIN,ndviHardMin:spec.NDVI_HARD_MIN,ibiStrongMin:spec.IBI_BARE_MAX,ndviBareMax:spec.NDVI_BARE_MAX,canopyMax:spec.NDVI_WATERCANOPY_MAX,dryMax:spec.MNDWI_DRY_MAX,yearBareMin:spec.NDVI_YEAR_BARE_MIN};
    const finite=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value)),extreme=(confirmed,legacy,fallback)=>Object.hasOwn(m,confirmed)?(finite(m[confirmed])?Number(m[confirmed]):fallback):(finite(m[legacy])?Number(m[legacy]):fallback);
    const mndwiMax=extreme("mndwiConfirmed","mndwiMax",mndwi),mndwiYear=extreme("mndwiConfirmedYear","mndwiMaxYear",mndwiMax),ndviMax=extreme("ndviConfirmed","ndviMax",ndvi),ndviYear=extreme("ndviConfirmedYear","ndviMaxYear",ndviMax);
    if(opts.excludeWater!==true&&((mndwi>=T.mndwiWaterMin&&mndwi>=ndvi)||(mndwiYear>=T.mndwiYearWaterMin&&ndvi<T.canopyMax&&ndviYear<T.canopyMax)))return"water";
    if(ndvi>=T.ndviGreenMin||ndviYear>=T.ndviYearGreenMin)return"green";
    const index=calcIbi(ndvi,mndwi,ndbi),dry=mndwi<T.dryMax;
    if(dry&&index!==null){if(ndvi>=T.ndviHardMin&&index>T.ibiHardMin)return"hard";if(ndvi<T.ndviBareMax){if(index>T.ibiStrongMin&&ndviYear<T.yearBareMin)return"hard";return"bare";}return"ambiguous";}
    return"ambiguous";
  }
  root.DG_VALIDATION_SPECTRAL_RULES=Object.freeze({ibi,thresholds,predict});
})(window);
