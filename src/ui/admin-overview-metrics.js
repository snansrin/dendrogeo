"use strict";
(function(root){
 function render(summary,getElement){
  getElement("aUsers").textContent=summary.users;
  getElement("aRec").textContent=summary.records;
  getElement("aProj").textContent=summary.projects;
  getElement("aCarbon").textContent=summary.carbon;
 }
 root.DG_ADMIN_OVERVIEW_METRICS_UI=Object.freeze({render});
})(window);
