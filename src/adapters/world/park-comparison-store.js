"use strict";
(function(root){
 function create(getClient){
  return Object.freeze({
   primary:()=>getClient().from("v_park_compare").select("*").order("carbon_kg",{ascending:false}),
   legacy:()=>getClient().from("measurements").select("carbon_kg,dbh_cm,height_m,species,grp,projects(name,city)",{count:"exact"}).eq("status","Onaylı").limit(5000),
   location:(column,value)=>getClient().from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").eq(column,value).limit(2000)
  });
 }
 root.DG_WORLD_PARK_COMPARISON_STORE=Object.freeze({create});
})(window);
