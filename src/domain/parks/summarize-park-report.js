"use strict";
(function(root){
 function summarize(rows,row,reportCount){
  const count=rows.length;
  const carbon=rows.reduce((sum,item)=>sum+(item.carbon_kg||0),0);
  const dbh=(rows.reduce((sum,item)=>sum+(item.dbh_cm||0),0)/count).toFixed(1);
  const height=(rows.reduce((sum,item)=>sum+(item.height_m||0),0)/count).toFixed(1);
  const conifers=rows.filter(item=>item.grp==="İBRELİ").length;
  const broadleaf=rows.filter(item=>item.grp==="YAPRAKLI").length;
  const bySpecies={};
  rows.forEach(item=>{const species=bySpecies[item.species]=bySpecies[item.species]||{count:0,carbon:0,dbh:0,height:0,group:item.grp||"DİĞER"};species.count++;species.carbon+=(item.carbon_kg||0);species.dbh+=(item.dbh_cm||0);species.height+=(item.height_m||0);});
  const species=Object.entries(bySpecies).sort((a,b)=>b[1].carbon-a[1].carbon);
  const projects=[...new Set(rows.map(item=>item.projects?.name).filter(Boolean))];
  const area=row&&Number(row.area_m2)>0?Number(row.area_m2):null;
  return{count,carbon,dbh,height,conifers,broadleaf,species,projects,area,carbonPerHa:area?(carbon/1000)/(area/10000):null,
   contributors:row&&row.contributors,reportCount,parkId:row&&row.park_id,city:rows[0].projects?.city||row&&row.city||"—",
   coniferPercent:count?((conifers/count)*100).toFixed(1):"0",broadleafPercent:count?((broadleaf/count)*100).toFixed(1):"0"};
 }
 root.DG_SUMMARIZE_PARK_REPORT=Object.freeze({summarize});
})(window);
