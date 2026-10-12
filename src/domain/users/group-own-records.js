"use strict";
(function(root){
 function group(rows){
  const sorted=(rows||[]).slice().sort((a,b)=>{
   const pa=(a.projects&&a.projects.name)||"",pb=(b.projects&&b.projects.name)||"";
   const comparison=String(pa).localeCompare(String(pb),"tr");
   return comparison!==0?comparison:((+a.point_id||0)-(+b.point_id||0))||((+a.measurement_no||1)-(+b.measurement_no||1));
  });
  const groups=new Map();
  for(const row of sorted){const name=(row.projects&&row.projects.name)||"Projesiz kayıtlar";if(!groups.has(name))groups.set(name,[]);groups.get(name).push(row);}
  return [...groups.entries()];
 }
 root.DG_GROUP_OWN_RECORDS=Object.freeze({group});
})(window);
