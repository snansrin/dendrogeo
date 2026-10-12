"use strict";
(function(root){
 async function updateStatus(sb,id,payload){return sb.from("measurements").update(payload).eq("id",id);}
 async function setGeoOverride(sb,id,userId){return sb.from("measurements").update({geo_override_by:userId}).eq("id",id);}
 async function readPhoto(sb,id){return sb.from("measurements").select("photo_url").eq("id",id).single();}
 async function deleteRecord(sb,id){return sb.from("measurements").delete().eq("id",id);}
 root.DG_ADMIN_MODERATION_STORE=Object.freeze({updateStatus,setGeoOverride,readPhoto,deleteRecord});
})(window);
