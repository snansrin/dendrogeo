/* Standard GIS PNG composition; reads presentation inputs only. */
(function(root){
 "use strict";
 // Translate only presentation text; preserve surrounding spacing and numeric inputs.
 const t=value=>root.document?.documentElement?.lang==="en"?String(value).replace(/\S(?:[\s\S]*\S)?/,text=>root.DG_PNG_I18N_EN?.[text]??root.dgT?.(text)??text):value;
 function draw({context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviTiers,ndviPolys,parkRings,holes=[],parkName,classMap,canvasApi,getLandcover,getGridCells,getWaypoints,vegetationColors,format:fmt,outline}){
  const {W,H,PAD,LEGEND}=layout;
  const dict=classMap;
  ctx.fillStyle="#f7f6f2";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#d4ded5";ctx.strokeRect(12,12,W-24,H-24);
  ctx.font="bold 25px system-ui,sans-serif";ctx.fillStyle="#14532d";ctx.fillText(t("DendroGeo · Doğrulanmış Harita"),PAD,44);
  ctx.font="14px system-ui,sans-serif";ctx.fillStyle="#475569";
  ctx.fillText((parkName||t("Park analizi"))+(ndvi?t(" · Göreli NDVI açık"):""),PAD,69);
  ctx.fillText(t("Katmanlar: ")+(ndvi?t("Park yüzeyi + göreli NDVI"):t("Park yüzeyi"))+
   t("  |  ")+new Date().toLocaleString(root.document?.documentElement?.lang==="en"?"en-GB":"tr-TR"),PAD,91);
  const {count}=root.DG_GIS_EXPORT_STANDARD_LAYERS.draw({
   context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviPolys,parkRings,holes,
   classMap:dict,canvasApi,getLandcover,getGridCells,getWaypoints,outline
  });
  canvasApi.drawLegend(ctx,{width:W,height:H,pad:PAD,legend:LEGEND,ndvi,tiers:ndviTiers,
   classes:dict,vegetationColors,format:fmt});
  return {count};
 }
 root.DG_GIS_EXPORT_STANDARD_CANVAS={draw};
})(window);
