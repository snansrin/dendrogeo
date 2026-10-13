"use strict";
(function(root){
 function build(ports,filters){
  return ports.buildMeasurementExportQuery(filters);
 }
 root.DG_BUILD_ADMIN_EXPORT_QUERY=Object.freeze({build});
})(window);
