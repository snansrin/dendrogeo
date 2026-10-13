"use strict";

/* Compose the live report while preserving its first-render baseline snapshot. */
window.DG_RENDER_SURFACE_CURRENT_REPORT={
  render({host,areas,baseline,setBaseline,presentation,areaBars,escape}){
    if(!host)return false;
    let original=baseline;if(!original){original=host.innerHTML;setBaseline(original);}
    host.innerHTML='<b>'+escape(presentation.currentTitle)+'</b>'+areaBars(areas)+'<p class="dg-sens-hint">'+escape(presentation.currentHint)+'</p><details class="dg-sens-details"><summary>'+escape(presentation.baselineTitle)+'</summary>'+original+'</details>';
    return true;
  }
};
