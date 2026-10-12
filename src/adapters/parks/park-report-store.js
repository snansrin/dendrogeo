"use strict";
(function(root){
 async function load(sb,primary,legacy){
  let query=sb.from("measurements").select(primary.select).eq("status","Onaylı");
  for(const filter of primary.filters)query=query.eq(filter.column,filter.value);
  const result=await query.limit(5000);
  if(!result.error)return{...result,usedLegacy:false};
  let fallback=sb.from("measurements").select(legacy.select).eq("status","Onaylı");
  for(const filter of legacy.filters)fallback=fallback.eq(filter.column,filter.value);
  const legacyResult=await fallback.limit(5000);
  return{...legacyResult,usedLegacy:true};
 }
 root.DG_PARK_REPORT_STORE=Object.freeze({load});
})(window);
