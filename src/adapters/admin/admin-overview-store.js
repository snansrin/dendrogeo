"use strict";
(function(root){
 function create(getClient){
  async function load(){
   const client=getClient();
   const[users,measurements,projects,global]=await Promise.all([
    client.from("profiles").select("*"),
    client.from("measurements").select("*,profiles!measurements_owner_fkey(full_name)").order("created_at",{ascending:false}),
    client.from("projects").select("*"),
    client.from("v_global").select("*").single()
   ]);
   const measurementCount=await client.from("measurements").select("*",{count:"exact",head:true});
   return{users,measurements,projects,global,measurementCount};
  }
  async function loadGlobal(){return getClient().from("v_global").select("*").single();}
  return Object.freeze({load,loadGlobal});
 }
 root.DG_ADMIN_OVERVIEW_STORE=Object.freeze({create});
})(window);
