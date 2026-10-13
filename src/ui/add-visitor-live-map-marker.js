"use strict";

/* Add the established escaped visitor marker and tooltip to the live layer. */
window.DG_ADD_VISITOR_LIVE_MAP_MARKER_UI={
  add({leaflet,layer,row,color,viewLabels,translate,escape}){
    const presentation=window.DG_VISITOR_MAP_MARKER_UI.build(row,{color,viewLabels,translate,escape});
    leaflet.marker([row.p.la,row.p.lo],{icon:leaflet.divIcon(presentation.icon),interactive:true,keyboard:false,zIndexOffset:700})
      .addTo(layer).bindTooltip(presentation.tooltip,presentation.tooltipOptions);
  }
};
