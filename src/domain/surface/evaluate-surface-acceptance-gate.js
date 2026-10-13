"use strict";

/* Explain why a surface draft cannot yet become an accepted result. */
window.DG_EVALUATE_SURFACE_ACCEPTANCE_GATE={
  evaluate({record,rawView,brush,busy,saving,geometry,draw,unresolvedWater}){
    return !record?"Kabul edilecek analiz bulunamadı.":rawView?"Ham görünüm açık; önce düzenlemeye dönün.":brush?"Fırça işlemi sürüyor; önce fırçayı kapatın.":saving||busy?"Yüzey işlemi sürüyor; tamamlanmasını bekleyin.":!geometry?"Park geometrisi hazır değil; analizi yeniden açın.":draw?"Sınır çizimi tamamlanmadı; çizimi tamamlayın veya iptal edin.":unresolvedWater>0?"Su sınırı dışındaki "+unresolvedWater+" raster-su hücresi güncel uydu verisiyle sınıflandırılamadı. Her belirsiz hücreyi yeşil, sert veya çıplak olarak inceleyip düzeltin; sonuç kabul edilmedi.":null;
  }
};
