"use strict";
(function(root){
 async function load(sb,userId){
  return sb.from("measurements").select("*,projects(name)").eq("owner",userId).order("created_at",{ascending:false});
 }
 root.DG_OWN_RECORDS_STORE=Object.freeze({load});
})(window);
