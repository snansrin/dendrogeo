"use strict";

/* Delegate owner export filters and downloads to the existing admin workflows. */
(function(root){
 function bind({document}){
  if(root._dgAdminExportActionsBound)return;
  root._dgAdminExportActionsBound=true;
  document.addEventListener("change",event=>{
   const element=event.target?.closest?.('[data-dg-admin-export-action]');
   if(!element)return;
   if(element.dataset.dgAdminExportAction==="country")root.admCountryChanged();
   if(element.dataset.dgAdminExportAction==="city")root.admCityChanged();
  });
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-admin-export-action]');
   if(!element)return;
   switch(element.dataset.dgAdminExportAction){
    case "csv":root.adminExportCSV();break;
    case "geo":root.adminExportGeo();break;
    case "qgis":root.adminExportQgis();break;
   }
  });
 }
 root.DG_ADMIN_EXPORT_ACTIONS=Object.freeze({bind});
})(window);

window.DG_ADMIN_EXPORT_ACTIONS.bind({document});
