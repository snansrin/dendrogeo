"use strict";

/* Format scan counts and explicit water-boundary uncertainty without changing classes. */
window.DG_BUILD_SURFACE_SCAN_SUMMARY={
  build({audit,autoWater,hasWaterFootprint,unresolvedWater,format}){
    let status=format("Uydu taraması tamamlandı: {profiled}/{total} hücrede yeterli gözlem, {diff} hücrede sınıf farkı. 2021 ham rasterı değişmedi.",{profiled:audit?.profiled||0,total:audit?.total||0,diff:audit?.transitions.reduce((count,item)=>count+item.cells,0)||0});
    if(autoWater)status+=" OSM su/havuz sınırları otomatik değerlendirildi ("+autoWater+" nesne).";
    if(hasWaterFootprint&&unresolvedWater)status+=" Su sınırı dışında "+unresolvedWater+" hücre belirsiz; yanlış su alanı kabul edilmedi, bu hücreleri haritada tek tek sınıflandırın.";
    return status;
  }
};
