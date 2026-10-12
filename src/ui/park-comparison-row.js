"use strict";
(function(root){
 function render(park,index,max,{escape,translate,formatHa}){
  const records=Number(park.records)||0,carbon=Number(park.carbon_kg)||0,area=Number(park.area_m2)||0;
  const perHa=area>0?(carbon/1000)/(area/10000):null;
  return `
  <div class="dg-cmp-row${index===0?" lead":""}">
   <div class="dg-cmp-rank">${index+1}</div>
   <div class="dg-cmp-main">
    <div class="dg-cmp-name">🌳 ${escape(park.park_name)} ${index===0?'<span class="badge on">🏆 En İyi</span>':""}</div>
    <div class="dg-cmp-meta">${escape(park.city||"—")} · 👥 ${park.contributors||0} ${translate("kişi")} · 📁 ${park.projects||0} ${translate("proje")} · ${records} ${translate("kayıt")}${park.species_n?` · ${park.species_n} ${translate("tür")}`:""} · ${translate("ort. çap")} ${(Number(park.avg_dbh)||0).toFixed(1)} cm · ${translate("ort. boy")} ${(Number(park.avg_height)||0).toFixed(1)} m${area>0?` · ${formatHa(area)}`:""}</div>
   </div>
   <div class="dg-cmp-ton">${(carbon/1000).toFixed(2)} t${perHa!==null?`<span class="dg-cmp-ha">${perHa.toFixed(2)} t/ha</span>`:""}</div>
   <div class="dg-cmp-bar"><div style="width:${max>0?(carbon/max*100).toFixed(0):0}%"></div></div>
  </div>`;
 }
 root.DG_PARK_COMPARISON_ROW=Object.freeze({render});
})(window);
