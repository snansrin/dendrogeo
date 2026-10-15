"use strict";
(function(root){
 function create(getClient){
  function storage(){return getClient().storage;}
  return Object.freeze({
   async loadMeasurementPhotoUrls(){
    const{data,error}=await getClient().from("measurements").select("photo_url");
    if(error)throw error;
    if(!Array.isArray(data))throw new Error("Ölçüm fotoğraf bağlantıları doğrulanamadı.");
    return data;
   },
   async listPhotoFiles(bucket,path,limit){
    const{data,error}=await storage().from(bucket).list(path,{limit});
    if(error)throw error;
    if(!Array.isArray(data))throw new Error("Fotoğraf depolama listesi doğrulanamadı.");
    return data;
   },
   getPhotoPublicUrl(bucket,path){
    const url=storage().from(bucket).getPublicUrl(path).data?.publicUrl;
    if(typeof url!=="string"||!url)throw new Error("Fotoğraf bağlantısı doğrulanamadı.");
    return url;
   },
   async removePhotoFiles(bucket,paths){
    const{error}=await storage().from(bucket).remove(paths);
    if(error)throw error;
   },
   countPendingMeasurements(){return getClient().from("measurements").select("*",{count:"exact",head:true}).eq("status","Beklemede");},
   deleteProject(id){return getClient().from("projects").delete().eq("id",id);},
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
