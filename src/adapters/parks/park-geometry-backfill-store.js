"use strict";

/* RLS-scoped park reads and boundary writes for the geometry backfill flow. */
(function(root){
  function create({getClient}){
    async function getPark(parkId){
      const{data}=await getClient().from("parks").select("*").eq("id",parkId).maybeSingle();
      return data||null;
    }
    async function saveGeometry(parkId,update){
      return getClient().from("parks").update(update).eq("id",parkId);
    }
    return Object.freeze({getPark,saveGeometry});
  }
  root.DG_PARK_GEOMETRY_BACKFILL_STORE=Object.freeze({create});
})(window);
