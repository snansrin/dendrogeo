"use strict";
(function(root){
 async function load(sb){
  const global=await sb.from("v_global").select("*").single();
  const countries=await sb.from("v_country").select("*");
  const cities=await sb.from("v_city").select("*");
  return{global,countries,cities};
 }
 root.DG_WORLD_STATS_STORE=Object.freeze({load});
})(window);
