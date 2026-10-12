"use strict";
(function(root){
 function build({measurements,projects,waypoints,requests},{exportedAt,exportedBy}){
  return{
   app:"DendroGeo",schema_version:"1.0.0",doi:"10.5281/zenodo.22948643",
   exported_at:exportedAt,exported_by:exportedBy,
   counts:{measurements:measurements.length,projects:projects.length,waypoints:waypoints.length,data_requests:requests.length},
   measurements,projects,waypoints,data_requests:requests
  };
 }
 root.DG_BACKUP_SNAPSHOT=Object.freeze({build});
})(window);
