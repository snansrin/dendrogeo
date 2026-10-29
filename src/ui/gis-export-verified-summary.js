"use strict";
/* Draw the park-area and relative-NDVI summary on verified GIS PNGs. */
(function(root){
 "use strict";
 // Translate only presentation text; preserve surrounding spacing and numeric inputs.
 const t=value=>root.document?.documentElement?.lang==="en"?String(value).replace(/\S(?:[\s\S]*\S)?/,text=>root.DG_PNG_I18N_EN?.[text]??root.dgT?.(text)??text):value;
 function draw({g,CW,parkHa,areas,layers,tiers,classes,getSurfaceTypes,formatArea,color}){
  const GREEN="#14532d",MUT="#5c6a63",INK="#182420",X0=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText(t("PARK SAHASI"),X0,300);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(Number(parkHa).toFixed(1)+t(" ha"),X0,352);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText(t("PARK ALANI ÖZETİ"),X0,420,CW-X0-40);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText(t("DOĞRULANMIŞ ALANLAR"),X0,470);
  let y=502;
  if(layers.surface)for(const k of ["green","water","hard","bare","building"]){
   const v=Number(areas[k]||0)+(k==="water"?Number(areas.pool||0):0);
   if(v<=0)continue;
   const label=getSurfaceTypes()?.[k]?.label||classes[k]?.label||k;
   g.fillStyle=color(k);g.fillRect(X0,y,26,26);
   g.fillStyle=INK;g.font="bold 19px Arial";g.fillText(t(label),X0+39,y+20,CW-X0-70);
   g.fillStyle=MUT;g.font="18px Arial";g.fillText(formatArea(v/10000)+t(" ha"),X0+39,y+44,CW-X0-70);
   y+=67;
  }
  y+=16;g.strokeStyle="#dfe5df";g.lineWidth=2;g.beginPath();g.moveTo(X0,y);g.lineTo(CW-40,y);g.stroke();y+=35;
  g.fillStyle=GREEN;g.font="bold 19px Arial";g.fillText(t("GÖRELİ NDVI · YEŞİL ALAN"),X0,y,CW-X0-35);y+=20;
  const counts={sparse:0,moderate:0,dense:0};
  for(const tier of tiers.tiers.values())if(tier in counts)counts[tier]++;
  for(const [key,label] of [["sparse","Seyrek"],["moderate","Orta"],["dense","Yoğun"]]){
   y+=18;g.fillStyle=color(key);g.fillRect(X0,y,22,22);
   g.fillStyle=INK;g.font="19px Arial";g.fillText(t(label)+t(": ")+counts[key]+t(" hücre"),X0+36,y+18,CW-X0-70);
  }
  y+=54;g.fillStyle=MUT;g.font="17px Arial";
  g.fillText(t("Uygun hücre: ")+tiers.count+t(" / ")+tiers.eligible,X0,y,CW-X0-40);
  y+=26;g.fillText(t("Eşikler: ")+tiers.cutoffs.map(n=>Number(n).toFixed(3)).join(t(" / ")),X0,y,CW-X0-40);
  y+=30;g.font="15px Arial";g.fillText(t("Park içi göreli sınıflama; taç örtüsü"),X0,y,CW-X0-40);
  y+=22;g.fillText(t("ölçümü değildir. ≥3 gözlem/hücre."),X0,y,CW-X0-40);
 }
 root.DG_GIS_EXPORT_VERIFIED_SUMMARY=Object.freeze({draw});
})(window);
