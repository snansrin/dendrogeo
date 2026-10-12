"use strict";
(function(root){
 function build(name,model,{date,latin}){
  return "\uFEFF"+["PARK,\""+name.replace(/"/g,'""')+"\"",
   "PARK_ID,"+(model.parkId||""),"SEHIR,"+(model.city||"—"),"ALAN_M2,"+(model.area||""),
   "KARBON_T_HA,"+(model.carbonPerHa!==null?model.carbonPerHa.toFixed(3):""),
   "PROJELER,\""+model.projects.join(" | ").replace(/"/g,'""')+"\"","TARIH,"+date,
   "KAYIT,"+model.count,"TOPLAM_KARBON_KG,"+model.carbon.toFixed(1),"TOPLAM_KARBON_T,"+(model.carbon/1000).toFixed(2),
   "ORT_CAP_CM,"+model.dbh,"ORT_BOY_M,"+model.height,"IBRELI_%,"+model.coniferPercent,"YAPRAKLI_%,"+model.broadleafPercent,
   "TUR,LATIN,GRUP,ADET,KARBON_KG,ORT_CAP_CM,ORT_BOY_M"]
   .concat(model.species.map(([species,value])=>[species,latin[species]||"—",value.group,value.count,value.carbon.toFixed(1),(value.dbh/value.count).toFixed(1),(value.height/value.count).toFixed(1)].join(","))).join("\n")+"\n";
 }
 root.DG_BUILD_PARK_REPORT_CSV=Object.freeze({build});
})(window);
