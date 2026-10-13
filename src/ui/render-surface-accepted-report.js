"use strict";

/* Render the immutable accepted result with the shared report presentation model. */
window.DG_RENDER_SURFACE_ACCEPTED_REPORT={
  render({result,host,areaBars,escape,presentation,formatDate}){
    if(!result||!host)return false;
    host.innerHTML='<b>'+escape(presentation.acceptedTitle)+'</b><p class="dg-meta">'+escape(formatDate(result.acceptedAt))+'</p>'+areaBars(result.areas)+'<p class="dg-sens-hint">'+escape(presentation.acceptedHint)+'</p>';
    return true;
  }
};
