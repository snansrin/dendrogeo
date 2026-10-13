"use strict";

/* Render class areas as the established compact report bars. */
window.DG_RENDER_SURFACE_AREA_BARS={
  render({areas,types,colors,escape,translate,hectares}){
    const total=Object.values(areas).reduce((sum,value)=>sum+Number(value||0),0);
    return Object.entries(areas).filter(([,value])=>value>0).map(([key,value])=>{const percent=total?100*value/total:0;return '<div class="dg-surface-stat"><span>'+escape(translate(types[key]?.label||key))+'</span><b>'+hectares(value)+' ha · %'+percent.toFixed(1)+'</b><div class="dg-surface-track" aria-hidden="true"><i style="width:'+percent+'%;background:'+colors[key]+'"></i></div></div>';}).join('');
  }
};
