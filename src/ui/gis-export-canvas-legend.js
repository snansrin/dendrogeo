/* Legend and source notes for standard GIS PNG exports. */
(function(root){
 "use strict";
 // Translate only presentation text; preserve surrounding spacing and numeric inputs.
 const t=value=>root.document?.documentElement?.lang==="en"?String(value).replace(/\S(?:[\s\S]*\S)?/,text=>root.DG_PNG_I18N_EN?.[text]??root.dgT?.(text)??text):value;
 function drawLegend(context,{width,height,pad,legend,ndvi,tiers,classes,vegetationColors,format}){
  const y=height-legend+26;
  context.fillStyle="#fff";context.fillRect(pad-10,y-26,width-2*pad+20,legend-40);
  context.font="bold 14px system-ui,sans-serif";context.fillStyle="#14532d";
  context.fillText(ndvi?t("Göreli NDVI · park içi üçlü yeşillik sınıfı"):t("Arazi örtüsü sınıfları"),pad,y);
  const swatches=ndvi?
   [["Seyrek",vegetationColors.sparse],["Orta",vegetationColors.moderate],["Yoğun",vegetationColors.dense]]:
   ["green","water","hard","bare"].map(key=>[classes[key]?.label||key,classes[key]?.color||"#94a3b8"]);
  let x=pad;for(const [label,color] of swatches){
   context.fillStyle=color;context.fillRect(x,y+17,15,12);context.fillStyle="#334155";
   context.font="13px system-ui,sans-serif";context.fillText(t(label),x+20,y+28);
   x+=Math.max(116,context.measureText(t(label)).width+46);
  }
  context.fillStyle="#64748b";context.font="11px system-ui,sans-serif";
  if(ndvi&&tiers?.count>=9){
   const distribution={sparse:0,moderate:0,dense:0};
   for(const tier of tiers.tiers?.values?.()||[])if(tier in distribution)distribution[tier]++;
   const line=t("Uygun yeşil hücre: ")+format(tiers.count)+" / "+format(tiers.eligible)+
    t("  ·  Seyrek ")+format(distribution.sparse)+t("  ·  Orta ")+format(distribution.moderate)+t("  ·  Yoğun ")+format(distribution.dense);
   context.font="12px system-ui,sans-serif";context.fillStyle="#334155";
   context.fillText(line,pad,height-112,width-pad*2);
   const cut=tiers.cutoffs;
   if(Array.isArray(cut)&&cut.length===2)
    context.fillText(t("NDVI park içi üçte birlik eşikleri: ")+cut.map(n=>Number(n).toFixed(3)).join(t(" / "))+t(" · Hücre başına en az 3 geçerli gözlem"),pad,height-89,width-pad*2);
  }
  context.fillText(ndvi?t("Göreli NDVI park içi karşılaştırmadır; mutlak taç örtüsü ölçümü değildir."):t("Kaynak: ESA WorldCover 2021 v200 · OSM sınırı"),pad,height-58);
  context.fillText(t("© OpenStreetMap katkıcıları (ODbL) · © ESA WorldCover (CC BY 4.0) · DendroGeo"),pad,height-39);
  context.fillText(t("Çıktı görselleştirmedir; kayıtlı bilimsel sonucun yerine geçmez."),pad,height-20);
 }
 root.DG_GIS_EXPORT_CANVAS_LEGEND=Object.freeze({drawLegend});
})(window);
