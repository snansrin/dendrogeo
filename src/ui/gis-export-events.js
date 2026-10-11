/* Compatibility bridge from existing PNG buttons to the modular GIS exporter. */
(function(root){
 "use strict";
 function bind({document,window,exportMap,exportVerified}){
  if(typeof document?.addEventListener!=="function")return false;
  document.addEventListener("click",event=>{
   const exportAction=event.target?.closest?.("#dgExportDownload");
   const sens=window.DG_LC_SENS?.state;
   if(exportAction&&sens?.vegetationView&&!sens.rawView){
    const dialog=exportAction.closest("dialog");
    if(dialog?.id==="dgSurfaceExportDialog"&&dialog.querySelector('[name="surface"]')?.checked){
     const layers=Object.fromEntries(["park","surface","grid","waypoints"].map(key=>[
      key,!!dialog.querySelector("[name=\""+key+"\"]")?.checked
     ]));
     event.preventDefault();
     event.stopImmediatePropagation();
     dialog.close();
     exportVerified(layers);
     return;
    }
   }
   const button=event.target?.closest?.('button[onclick*="downloadParkImage"]');
   if(!button)return;
   event.preventDefault();
   event.stopImmediatePropagation();
   exportMap();
  },true);
  return true;
 }
 root.DG_GIS_EXPORT_EVENTS=Object.freeze({bind});
})(window);
