"use strict";

/* Select report labels for raw, draft, and accepted surface states. */
window.DG_BUILD_SURFACE_REPORT_MODEL={
  build({rawView,editing,translate}){
    return{
      currentTitle:translate(rawView?"Ham 2021 raster sonucu":editing?"Güncel yüzey önizlemesi":"Kayıtlı analiz sonucu"),
      currentHint:translate(editing?"Hassasiyet barları, fırça ve sınır düzeltmeleri bu özete yansır. Yayın için kabul edip kaydedin.":"Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez."),
      baselineTitle:translate("Ham 2021 raster sonucu"),
      acceptedTitle:translate("Kayıtlı analiz sonucu"),
      acceptedHint:translate("Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez.")
    };
  }
};
