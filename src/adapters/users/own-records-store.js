"use strict";
(function(root){
 async function load(sb,userId){
  const result=await sb.from("measurements").select("*,projects(name)").eq("owner",userId).order("created_at",{ascending:false});
  if(!result.error)return result;
  const relationshipMissing=["PGRST200","PGRST201","PGRST204"].includes(result.error.code)||/relationship|schema cache|foreign key/i.test(result.error.message||"");
  if(!relationshipMissing)return result;
  // A missing PostgREST relationship must not hide the user's measurements.
  // RLS still scopes this fallback to the signed-in owner.
  return sb.from("measurements").select("*").eq("owner",userId).order("created_at",{ascending:false});
 }
 root.DG_OWN_RECORDS_STORE=Object.freeze({load});
})(window);
