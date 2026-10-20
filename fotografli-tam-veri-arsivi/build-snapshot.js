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
 function buildComplete(input,meta){
  const baseline=build(input,meta);
  const extraNames=["profiles","report_requests","report_retractions","park_invites","park_collaborators","site_metric_daily","site_visits"];
  const extra={},counts={...baseline.counts};
  for(const name of extraNames){
   const rows=input[name];
   if(!Array.isArray(rows))throw new Error("Eksik yedek tablosu: "+name);
   extra[name]=rows;counts[name]=rows.length;
  }
  return{
   ...baseline,schema_version:"2.0.0",
   scope:{
    access:"current-session-rls",complete_system_backup:false,
    photo_files_included:true,
    excluded:["auth-credentials-and-accounts","device-local-offline-queue","local-validation-campaigns","database-schema-and-policies","published-report-archives"],
    note:"Kullanıcının Supabase RLS izinleriyle erişebildiği kayıtlar; Auth ve yerel veriler bu pakette yer almaz."
   },
   counts,...extra
  };
 }
 root.DG_BACKUP_SNAPSHOT=Object.freeze({build,buildComplete});
})(window);
