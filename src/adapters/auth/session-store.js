"use strict";
(function(root){
 function create(getClient){
  return Object.freeze({
   getSession(){return getClient().auth.getSession();},
   loadProfile(id){return getClient().from("profiles").select("*").eq("id",id).single();}
  });
 }
 root.DG_AUTH_SESSION_STORE=Object.freeze({create});
})(window);
