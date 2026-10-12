"use strict";
(function(root){
 const REPORT_FIELDS="carbon_kg,dbh_cm,height_m,species,grp,point_id,projects(name,city,park_id,park_name)";
 function build(target){
  return{select:REPORT_FIELDS.replace("projects(","projects!inner("),filters:target.isPark
   ?[{column:"projects.park_id",value:target.row.park_id}]
   :[{column:"projects.name",value:target.name}]};
 }
 root.DG_BUILD_PARK_REPORT_REQUEST=Object.freeze({build});
})(window);
