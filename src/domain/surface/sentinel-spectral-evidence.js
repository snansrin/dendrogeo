"use strict";
/* Robust spectral summaries, confirmed extremes, and PB04 reflectance. */
(function(root){
  function median(values){if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b),middle=sorted.length>>1;return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
  function confirmedExtreme(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>b-a);return sorted.length>=2?sorted[1]:null;}
  function vegetationSummary(evidence){const dates=evidence?.dates instanceof Set?evidence.dates:new Set(evidence?.dates||[]);return{ndviMedianYear:median(evidence?.ndvi||[]),ndviObs:dates.size};}
  function reflectance(raw,item,band,scale){const value=Number(raw);if(!Number.isFinite(value)||value<=0||value>=65535)return null;const asset=item?.assets?.[band],meta=asset?.["raster:bands"]?.[0],baseline=Number(item?.properties?.["s2:processing_baseline"]),date=String(item?.properties?.datetime||""),offset=Number.isFinite(meta?.offset)?meta.offset:((Number.isFinite(baseline)?baseline>=4:date>="2022-01-25")?-1000:0),result=Number.isFinite(meta?.scale)?value*meta.scale+(Number.isFinite(meta?.offset)?meta.offset:0):(value+offset)/scale;return Number.isFinite(result)&&result>=-0.1&&result<=1.6?Math.max(0,result):null;}
  root.DG_SENTINEL_SPECTRAL_EVIDENCE=Object.freeze({median,confirmedExtreme,vegetationSummary,reflectance});
})(window);
