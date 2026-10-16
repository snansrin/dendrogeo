"use strict";
/* Read only the public, administrator-approved cartographic snapshot. */
window.DG_READ_ACCEPTED_PARK_SURFACE={async load(client,parkId){
 const{data,error}=await client.rpc("dg_accepted_park_surface",{p_park:Number(parkId)});
 if(error)throw error;
 return data?.result||null;
}};
