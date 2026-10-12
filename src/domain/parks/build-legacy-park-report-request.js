"use strict";
(function(root){
 function build(name){
  return{select:"carbon_kg,dbh_cm,height_m,species,grp,point_id,projects(name,city)",filters:[{column:"projects.name",value:name}]};
 }
 root.DG_BUILD_LEGACY_PARK_REPORT_REQUEST=Object.freeze({build});
})(window);
