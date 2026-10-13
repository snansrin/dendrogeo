"use strict";
(function(root){
 function apply(query,table){
  const text=String(query).toLowerCase();
  table.querySelectorAll("tr").forEach(row=>{row.style.display=row.textContent.toLowerCase().includes(text)?"":"none";});
 }
 root.DG_ADMIN_MEASUREMENT_FILTER=Object.freeze({apply});
})(window);
