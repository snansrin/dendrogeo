"use strict";
(function(root){
 function update(document,values){
  const records=document.getElementById("dMy"),carbon=document.getElementById("dCarbon");
  if(records)records.textContent=values.records;
  if(carbon)carbon.textContent=values.carbon;
 }
 root.DG_OWNER_DASHBOARD_VIEW=Object.freeze({update});
})(window);
