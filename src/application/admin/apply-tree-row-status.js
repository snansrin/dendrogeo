"use strict";
(function(root){
 function apply(rows,id,status,shared,ports){
  const row=rows.find(value=>Number(value.id)===Number(id));
  if(!row)return false;
  row.status=status;
  if(shared!=null)row.shared=shared;
  try{ports.draw();}catch(error){}
  try{ports.renderFlat(rows);}catch(error){}
  return true;
 }
 root.DG_APPLY_ADMIN_TREE_ROW_STATUS=Object.freeze({apply});
})(window);
