/* Legend and source notes for standard GIS PNG exports. */
(function(root){
 "use strict";
 function drawLegend(context,{width,height,pad,legend,ndvi,tiers,classes,vegetationColors,format}){
  const y=height-legend+26;
  context.fillStyle="#fff";context.fillRect(pad-10,y-26,width-2*pad+20,legend-40);
  context.font="bold 14px system-ui,sans-serif";context.fillStyle="#14532d";
  context.fillText(ndvi?"Göreli NDVI · park içi üçlü yeşillik sınıfı":"Arazi örtüsü sınıfları",pad,y);
  const swatches=ndvi?
   [["Seyrek",vegetationColors.sparse],["Orta",vegetationColors.moderate],["Yoğun",vegetationColors.dense]]:
   ["green","water","hard","bare"].map(key=>[classes[key]?.label||key,classes[key]?.color||"#94a3b8"]);
  let x=pad;for(const [label,color] of swatches){
   context.fillStyle=color;context.fillRect(x,y+17,15,12);context.fillStyle="#334155";
   context.font="13px system-ui,sans-serif";context.fillText(label,x+20,y+28);
   x+=Math.max(116,context.measureText(label).width+46);
  }
  context.fillStyle="#64748b";context.font="11px system-ui,sans-serif";
  if(ndvi&&tiers?.count>=9){
   const distribution={sparse:0,moderate:0,dense:0};
   for(const tier of tiers.tiers?.values?.()||[])if(tier in distribution)distribution[tier]++;
   const line="Uygun yeşil hücre: "+format(tiers.count)+" / "+format(tiers.eligible)+
    "  ·  Seyrek "+format(distribution.sparse)+"  ·  Orta "+format(distribution.moderate)+"  ·  Yoğun "+format(distribution.dense);
   context.font="12px system-ui,sans-serif";context.fillStyle="#334155";
   context.fillText(line,pad,height-112,width-pad*2);
   const cut=tiers.cutoffs;
   if(Array.isArray(cut)&&cut.length===2)
    context.fillText("NDVI park içi üçte birlik eşikleri: "+cut.map(n=>Number(n).toFixed(3)).join(" / ")+" · Hücre başına en az 3 geçerli gözlem",pad,height-89,width-pad*2);
  }
  context.fillText(ndvi?"Göreli NDVI park içi karşılaştırmadır; mutlak taç örtüsü ölçümü değildir.":"Kaynak: ESA WorldCover 2021 v200 · OSM sınırı",pad,height-58);
  context.fillText("© OpenStreetMap katkıcıları (ODbL) · © ESA WorldCover (CC BY 4.0) · DendroGeo",pad,height-39);
  context.fillText("Çıktı görselleştirmedir; kayıtlı bilimsel sonucun yerine geçmez.",pad,height-20);
 }
 root.DG_GIS_EXPORT_CANVAS_LEGEND=Object.freeze({drawLegend});
})(window);
