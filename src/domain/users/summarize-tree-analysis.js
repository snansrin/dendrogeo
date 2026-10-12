"use strict";
(function(root){
 function summarize(rows){
  rows=rows||[];
  if(!rows.length)return null;
  const groups={"İBRELİ":{n:0,dbh:0,h:0},"YAPRAKLI":{n:0,dbh:0,h:0},"DİĞER":{n:0,dbh:0,h:0}};
  const bySpecies={};
  rows.forEach(row=>{
   const group=groups[row.grp]?row.grp:"DİĞER";
   groups[group].n++;groups[group].dbh+=(row.dbh_cm||0);groups[group].h+=(row.height_m||0);
   bySpecies[row.species]=bySpecies[row.species]||{n:0,grp:group};
   bySpecies[row.species].n++;
  });
  const total=rows.length;
  const percent=count=>total?((count/total)*100).toFixed(1):"0.0";
  const averageDbh=(rows.reduce((sum,row)=>sum+(row.dbh_cm||0),0)/total).toFixed(1);
  const averageHeight=(rows.reduce((sum,row)=>sum+(row.height_m||0),0)/total).toFixed(1);
  const topSpecies=Object.entries(bySpecies).sort((a,b)=>b[1].n-a[1].n).slice(0,6);
  return{groups,total,averageDbh,averageHeight,percent:groups?{
   conifer:percent(groups["İBRELİ"].n),broadleaf:percent(groups["YAPRAKLI"].n),other:percent(groups["DİĞER"].n),
  }:null,topSpecies};
 }
 root.DG_TREE_ANALYSIS_SUMMARY=Object.freeze({summarize});
})(window);
