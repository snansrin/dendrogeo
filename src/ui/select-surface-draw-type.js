"use strict";

/* Apply a supported boundary class to the active drawing controls. */
window.DG_SELECT_SURFACE_DRAW_TYPE={
  select({state,type,types,colors,document,querySelectorAll}){
    if(type==="pool")type="water";
    if(!types[type])return false;
    state.drawType=type;if(state.draw)state.draw.type=type;state.objectPreviewLayer?.setStyle?.({color:colors[type]||colors.other});
    const select=document.getElementById("dgSensDrawType");if(select)select.value=type;
    querySelectorAll("#dgSensBoundaryDetails .dg-boundary-swatch").forEach(button=>{
      const active=button.dataset.surfaceType===type;button.classList.toggle("is-selected",active);button.setAttribute("aria-pressed",String(active));
    });
    return true;
  }
};
