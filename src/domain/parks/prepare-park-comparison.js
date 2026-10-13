"use strict";
(function(root){
 function prepare(rows){
  const all=rows||[],linked=all.filter(row=>Number(row.park_id)>0),pending=all.filter(row=>!(Number(row.park_id)>0));
  const max=linked.length?Math.max(...linked.map(row=>Number(row.carbon_kg)||0)):1;
  return{linked,pending,max};
 }
 root.DG_PREPARE_PARK_COMPARISON=Object.freeze({prepare});
})(window);
