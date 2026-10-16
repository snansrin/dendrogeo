"use strict";
window.DG_CREATE_FULL_BACKUP={
 async execute(profile,{load,build,name,download,remember,onDenied,onStart,onSuccess,onFailure}){
  if(!profile||(profile.role!=="admin"&&profile.role!=="owner"))return onDenied();
  onStart();
  try{
   const measurements=await load("measurements","created_at");
   const projects=await load("projects","id");
   const waypoints=await load("waypoints","id");
   const requests=await load("data_requests","id");
   const parks=await load("parks","id");
   const surface_reviews=await load("surface_reviews","park_id");
   const backup=build({measurements,projects,waypoints,requests,parks,surface_reviews});
   const filename=name();download(backup,filename);remember();onSuccess(filename,measurements.length);
  }catch(error){onFailure(error);}
 }
};
