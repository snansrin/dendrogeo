"use strict";

/* Export view buttons delegate to the existing serializer/download workflows. */
(function(root){
  const handlers={
    "csv-download":()=>root.exportCSV(),
    "csv-preview":()=>root.previewCSV(),
    "geo-download":()=>root.exportGeo(),
    "geo-preview":()=>root.previewGeo(),
    "qgis-download":()=>root.exportQgis(),
    "qgis-preview":async()=>{
      const preview=await root.DG_PREPARE_USER_MEASUREMENT_PREVIEW.execute('qgis',root.dgUserExportPorts());
      return root.openPreview(preview.title,preview.content,preview.isCSV,preview.fileName);
    },
    "close-preview":()=>root.closePreview()
  };
  function bind({document}){
    if(root._dgExportViewActionsBound)return;
    root._dgExportViewActionsBound=true;
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-export-action]");if(!element)return;
      const action=element.dataset.dgExportAction,handler=handlers[action];
      if(handler){if(action!=='close-preview'&&action.endsWith('-preview'))element.focus?.({preventScroll:true});handler();}
    });
  }
  root.DG_EXPORT_VIEW_ACTIONS=Object.freeze({bind});
})(window);

window.DG_EXPORT_VIEW_ACTIONS.bind({document});
