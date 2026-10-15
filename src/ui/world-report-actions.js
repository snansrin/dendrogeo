"use strict";

/* Keep report creation in the world screen's UI action boundary. */
(function(root){
 function bind({document}){
  if(root._dgWorldReportActionsBound)return;
  root._dgWorldReportActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-world-action="create-report"]');
   if(element)root.parkReport();
  });
 }
 root.DG_WORLD_REPORT_ACTIONS=Object.freeze({bind});
})(window);

window.DG_WORLD_REPORT_ACTIONS.bind({document});
