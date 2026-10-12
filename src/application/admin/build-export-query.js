"use strict";
(function(root){
 function build(query,{country,city,project,status}){
  let result=query().from("measurements").select("*,projects(name)");
  if(country)result=result.eq("country",country);
  if(city)result=result.eq("city",city);
  if(project)result=result.eq("project_id",+project);
  if(status)result=result.eq("status",status);
  return result;
 }
 root.DG_BUILD_ADMIN_EXPORT_QUERY=Object.freeze({build});
})(window);
