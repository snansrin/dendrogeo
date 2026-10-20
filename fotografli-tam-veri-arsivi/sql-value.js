"use strict";
(function(root){
 function serialize(value){
  if(value===null||value===undefined)return "NULL";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"NULL";
  if(typeof value==="boolean")return value?"true":"false";
  if(typeof value==="object")return "'"+JSON.stringify(value).replace(/'/g,"''")+"'";
  return "'"+String(value).replace(/'/g,"''")+"'";
 }
 root.DG_BACKUP_SQL_VALUE=Object.freeze({serialize});
})(window);
