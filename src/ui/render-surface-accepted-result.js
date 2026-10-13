"use strict";

/* Render the immutable accepted result from the report host. */
window.DG_RENDER_SURFACE_ACCEPTED_RESULT={
  render({result,host,areaBars,escape,translate,formatDate}){
    const renderer=window.DG_RENDER_SURFACE_ACCEPTED_REPORT,model=window.DG_BUILD_SURFACE_REPORT_MODEL;
    if(renderer&&model)return renderer.render({result,host,areaBars,escape,presentation:model.build({rawView:false,editing:false,translate}),formatDate});
    if(!result||!host)return false;
    host.innerHTML='<b>'+escape(translate("Kayıtlı analiz sonucu"))+'</b><p class="dg-meta">'+escape(formatDate(result.acceptedAt))+'</p>'+areaBars(result.areas)+'<p class="dg-sens-hint">'+escape(translate("Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."))+'</p>';
    return true;
  }
};
