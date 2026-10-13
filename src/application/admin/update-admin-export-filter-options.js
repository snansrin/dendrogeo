"use strict";
(function(root){
 function countryChanged(rows,projects,country,ports){
  ports.fillCity(ports.listCities(rows,projects,country));
  ports.cityChanged();
 }
 function cityChanged(projects,country,city,ports){
  ports.fillProject(ports.listProjects(projects,country,city,true));
 }
 root.DG_UPDATE_ADMIN_EXPORT_FILTER_OPTIONS=Object.freeze({countryChanged,cityChanged});
})(window);
