"use strict";
/* Supabase adapter for park-linked project creation. */
(function(root){
  function create({getClient}){
    async function insert(project){
      return await getClient().from("projects").insert(project).select().single();
    }
    return Object.freeze({insert});
  }
  root.DG_PARK_PROJECT_STORE_ADAPTER=Object.freeze({create});
})(window);
