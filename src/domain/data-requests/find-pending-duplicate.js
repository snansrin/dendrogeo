"use strict";

/* Match the existing request filters; pending-status selection belongs to the caller. */
(function(root){
 function find(pending,filters){
  const norm=value=>(value||"").toString().trim().toLowerCase();
  return (pending||[]).find(row=>norm(row.country)===norm(filters.country)&&norm(row.city)===norm(filters.city)&&norm(row.project_name)===norm(filters.project_name));
 }
 root.DG_DATA_REQUEST_DUPLICATE=Object.freeze({find});
})(window);
