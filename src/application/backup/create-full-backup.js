"use strict";
window.DG_CREATE_FULL_BACKUP={
 async execute(profile,{load,build,name,download,remember,onDenied,onStart,onSuccess,onFailure}){
  if(!profile||(profile.role!=="admin"&&profile.role!=="owner"))return onDenied();
  onStart();
  try{
   const measurements=await load("measurements","created_at");
   const projects=await load("projects","id");
   const waypoints=await load("waypoints","id");
   let requests=[];
   try{requests=await load("data_requests","created_at");}catch(error){requests=[];}
   const backup=build({measurements,projects,waypoints,requests});
   const filename=name();download(backup,filename);remember();onSuccess(filename,measurements.length);
  }catch(error){onFailure(error);}
 }
};
