"use strict";
(function(root){
 function render(name,model,{escape,translate,formatHa,date}){
  const percent=value=>model.count?((value/model.count)*100).toFixed(1):"0";
  return `
  <div class="alert info" style="margin-bottom:12px">🌳 <b>${escape(name)}</b> · 👥 ${model.contributors?model.contributors+" "+translate("kişi"):model.projects.length+" "+translate("proje")} · 📁 ${model.projects.length} ${translate("proje")} · ${model.reportCount!=null?model.reportCount+" "+translate("onaylı kayıt")+" ("+translate("raporda")+" "+model.count+")":model.count+" "+translate("kayıt")}</div>
  <div class="grid g4" style="margin-bottom:14px">
   <div class="stat" style="padding:12px"><div class="lbl">Kayıt</div><div class="val" style="font-size:1.1rem">${model.count}</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Karbon</div><div class="val" style="font-size:1.1rem">${(model.carbon/1000).toFixed(2)} t</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Çap</div><div class="val" style="font-size:1.1rem">${model.dbh} cm</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Boy</div><div class="val" style="font-size:1.1rem">${model.height} m</div></div>
  </div>
  <div style="font-size:.78rem;color:var(--mut);margin-bottom:12px">${translate("🌲 İbreli")} %${percent(model.conifers)} · ${translate("🍃 Yapraklı")} %${percent(model.broadleaf)} · ${translate("Diğer")} %${percent(model.count-model.conifers-model.broadleaf)}${model.area?` · ${translate("alan")} ${formatHa(model.area)}${model.carbonPerHa!==null?` · <b>${model.carbonPerHa.toFixed(2)} t/ha</b>`:""}`:""} · ${date}</div>
  ${model.projects.length>1?`<div style="font-size:.74rem;color:var(--mut);margin-bottom:10px">Bu parkta birleşen projeler: ${model.projects.map(escape).join(" · ")}</div>`:""}`;
 }
 root.DG_PARK_REPORT_SUMMARY_UI=Object.freeze({render});
})(window);
