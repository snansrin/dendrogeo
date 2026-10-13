"use strict";
(function(root){
 function group(rows){
  const by={};
  (rows||[]).forEach(row=>{
   const name=row.projects?.name||"—";
   const park=by[name]=by[name]||{name,city:row.projects?.city||"—",n:0,c:0,dbh:0,h:0};
   park.n++;park.c+=(row.carbon_kg||0);park.dbh+=(row.dbh_cm||0);park.h+=(row.height_m||0);
  });
  const parks=Object.values(by).sort((a,b)=>b.c-a.c);
  return{parks,max:parks.length?parks[0].c:1};
 }
 root.DG_GROUP_LEGACY_PARK_COMPARISON=Object.freeze({group});
})(window);
