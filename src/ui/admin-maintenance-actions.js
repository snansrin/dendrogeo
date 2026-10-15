"use strict";

/* Delegate owner maintenance commands to existing admin workflows. */
(function(root){
 const handlers={
  "clean-orphans":()=>root.cleanOrphans(),
  "re-geocode":()=>root.reGeocodeAll(),
  "backfill-parks":()=>root.backfillParks()
 };
 function bind({document}){
  if(root._dgAdminMaintenanceActionsBound)return;
  root._dgAdminMaintenanceActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-maintenance-action]');
   const handler=element&&handlers[element.dataset.dgMaintenanceAction];
   if(handler)handler(element);
  });
 }
 root.DG_ADMIN_MAINTENANCE_ACTIONS=Object.freeze({bind});
})(window);

window.DG_ADMIN_MAINTENANCE_ACTIONS.bind({document});
