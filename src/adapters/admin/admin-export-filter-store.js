"use strict";
(function(root){
 function create(getClient){
  function load(){const client=getClient();return Promise.all([
   client.from("measurements").select("country,city"),
   client.from("projects").select("id,name,country,city").order("name")
  ]);}
  return Object.freeze({load});
 }
 root.DG_ADMIN_EXPORT_FILTER_STORE=Object.freeze({create});
})(window);
