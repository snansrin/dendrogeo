"use strict";

/* Load the request and its approved dataset with the existing filter contract. */
window.DG_DATA_REQUEST_FULFILLMENT_STORE={
 async load(client,id){
  const {data:request}=await client.from("data_requests").select("*,profiles(full_name)").eq("id",id).single();
  if(!request)return null;
  let projectIds=null;
  if(request.project_name){
   const {data:projects}=await client.from("projects").select("id").ilike("name","%"+request.project_name+"%");
   projectIds=(projects||[]).map(project=>project.id);
  }
  let query=client.from("measurements").select("*").eq("status","Onaylı");
  if(request.country)query=query.eq("country",request.country);
  if(request.city)query=query.eq("city",request.city);
  if(projectIds)query=query.in("project_id",projectIds.length?projectIds:[-1]);
  const {data}=await query;
  return{request,rows:data||[]};
 }
};
