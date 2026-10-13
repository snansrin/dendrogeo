"use strict";
(function(root){
 function create(getClient){
  function storage(){return getClient().storage;}
  return Object.freeze({
   loadMeasurementPhotoUrls(){return getClient().from("measurements").select("photo_url");},
   listPhotoFiles(bucket,path,limit){return storage().from(bucket).list(path,{limit});},
   getPhotoPublicUrl(bucket,path){return storage().from(bucket).getPublicUrl(path).data.publicUrl;},
   removePhotoFiles(bucket,paths){return storage().from(bucket).remove(paths);},
   countPendingMeasurements(){return getClient().from("measurements").select("*",{count:"exact",head:true}).eq("status","Beklemede");},
   buildMeasurementExportQuery(filters){
    let query=getClient().from("measurements").select("*,projects(name)");
    if(filters.country)query=query.eq("country",filters.country);
    if(filters.city)query=query.eq("city",filters.city);
    if(filters.project)query=query.eq("project_id",+filters.project);
    if(filters.status)query=query.eq("status",filters.status);
    return query;
   }
  });
 }
 root.DG_ADMIN_PERSISTENCE_STORE=Object.freeze({create});
})(window);
