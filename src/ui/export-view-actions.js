"use strict";

/* Export view buttons delegate to the existing serializer/download workflows. */
(function(root){
  const handlers={
    "csv-download":()=>root.exportCSV(),
    "csv-preview":()=>root.previewCSV(),
    "geo-download":()=>root.exportGeo(),
    "geo-preview":()=>root.previewGeo(),
    "qgis-download":()=>root.exportQgis()
  };
  function bind({document}){
    if(root._dgExportViewActionsBound)return;
    root._dgExportViewActionsBound=true;
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-export-action]");if(!element)return;
      const handler=handlers[element.dataset.dgExportAction];if(handler)handler();
    });
  }
  root.DG_EXPORT_VIEW_ACTIONS=Object.freeze({bind});
})(window);

window.DG_EXPORT_VIEW_ACTIONS.bind({document});
