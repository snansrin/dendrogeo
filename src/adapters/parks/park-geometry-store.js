"use strict";
/* Supabase adapter for persisting a park boundary. */
(function(root){
  function create({getClient}){
    async function updateGeometry(parkId,geom){
      return await getClient().from("parks").update({geom_json:geom}).eq("id",parkId).select().single();
    }
    return Object.freeze({updateGeometry});
  }
  root.DG_PARK_GEOMETRY_STORE_ADAPTER=Object.freeze({create});
})(window);
