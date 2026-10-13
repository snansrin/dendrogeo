"use strict";
(function(root){
 async function load(sb){
  const global=await sb.from("v_global").select("*").single();
  const countries=await sb.from("v_country").select("*");
  const cities=await sb.from("v_city").select("*");
  return{global,countries,cities};
 }
 async function loadForLanding(sb){
  const results=await Promise.allSettled([
   sb.from("v_global").select("*").single(),
   sb.from("v_country").select("*"),
   sb.from("v_city").select("*")
  ]);
  const errors=results.filter(result=>result.status==="rejected").map(result=>result.reason);
  for(const result of results)if(result.status==="fulfilled"&&result.value?.error)errors.push(result.value.error);
  const values=results.map(result=>result.status==="fulfilled"&&!result.value?.error?result.value:null);
  return{global:values[0],countries:values[1],cities:values[2],errors};
 }
 root.DG_WORLD_STATS_STORE=Object.freeze({load,loadForLanding});
})(window);
