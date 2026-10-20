"use strict";
(function(root){
 function build({measurements,projects,waypoints,requests,parks=[],surface_reviews=[]},{exportedAt,exportedBy}){
  return{
   app:"DendroGeo",schema_version:"1.1.0",doi:"10.5281/zenodo.22948773",
   exported_at:exportedAt,exported_by:exportedBy,
   scope:{access:"current-session-rls",complete_system_backup:false,
    excluded:["auth","storage-file-bytes","local-validation-campaigns","offline-queue","database-schema-and-policies","publication-archives"]},
   counts:{measurements:measurements.length,projects:projects.length,waypoints:waypoints.length,data_requests:requests.length,parks:parks.length,surface_reviews:surface_reviews.length},
   parks,projects,measurements,waypoints,data_requests:requests,surface_reviews
  };
 }
 root.DG_BACKUP_SNAPSHOT=Object.freeze({build});
})(window);
