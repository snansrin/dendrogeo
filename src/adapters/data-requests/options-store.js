"use strict";

/* Preserve the request form's parallel approved-location and project reads. */
window.DG_DATA_REQUEST_OPTIONS_STORE={
 async load(client){
  const [measurements,projects]=await Promise.all([
   client.from("measurements").select("country,city",{count:"exact"}).eq("status","Onaylı").limit(5000),
   client.from("projects").select("id,name,country,city").order("name")
  ]);
  return{measurements,projects};
 }
};
