"use strict";
(function(root){
 function resolve(key,parkRows){
  if(!key)return null;
  const row=(parkRows||[]).find(item=>String(item.park_id)===String(key));
  const isPark=!!row&&Number(row.park_id)>0;
  return{row,isPark,name:isPark?row.park_name:String(key).replace(/^proj:/,"")};
 }
 root.DG_RESOLVE_PARK_REPORT_TARGET=Object.freeze({resolve});
})(window);
