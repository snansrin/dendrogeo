"use strict";
(function(root){
 function remove(rows,id,ports){
  const index=rows.findIndex(value=>Number(value.id)===Number(id));
  if(index<0)return false;
  rows.splice(index,1);
  try{ports.draw();}catch(error){}
  try{ports.renderFlat(rows);}catch(error){}
  return true;
 }
 root.DG_REMOVE_ADMIN_TREE_ROW=Object.freeze({remove});
})(window);
