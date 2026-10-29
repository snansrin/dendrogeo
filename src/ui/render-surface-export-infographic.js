"use strict";
/* Paint branded title, reviewed-area summary, legend and source footer. */
(function(root){
 "use strict";
 // Translate only presentation text; preserve surrounding spacing and numeric inputs.
 const t=value=>root.document?.documentElement?.lang==="en"?String(value).replace(/\S(?:[\s\S]*\S)?/,text=>root.DG_PNG_I18N_EN?.[text]??root.dgT?.(text)??text):value;
 function render({context,width,height,green,muted,ink,colors,park,parkDate,viewLabel,mapTitle="DOĞRULANMIŞ PARK HARİTASI",areasTitle="DOĞRULANMIŞ ALANLAR",footerNote="Kesin hücre geometrisi ve doğrulanmış yüzey sınıfları.",parkAreaLabel,layers,areas,ha,labelForClass,fingerprint}){
  const g=context,X0=840;
  g.fillStyle=green;g.fillRect(0,0,width,120);g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText(t("DENDROGEO"),40,72);g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText(t("Küresel Ağaç Envanteri ve Karbon Veri Sistemi"),40,102);g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText(t("dendrogeo.org"),width-40,70);g.textAlign="left";
  g.fillStyle=green;g.font="bold 32px Arial";g.fillText(t(mapTitle),40,172);g.fillStyle=muted;g.font="22px Arial";g.fillText((park.name||t("Park"))+t(" · ")+parkDate+t(" · ")+t(viewLabel),40,206);
  g.fillStyle=muted;g.font="bold 20px Arial";g.fillText(t("PARK SAHASI"),X0,300);g.fillStyle=ink;g.font="bold 54px Arial";g.fillText(parkAreaLabel+t(" ha"),X0,352);g.fillStyle=muted;g.font="bold 20px Arial";g.fillText(t("PARK ALANI ÖZETİ"),X0,420,width-X0-40);
  g.fillStyle=muted;g.font="bold 20px Arial";g.fillText(t(areasTitle),X0,470);let y=510;
  for(const [key,name] of [["park","Park alanı"],["surface","Park analizi"],["grid","Gridler"],["waypoints","Waypointler"]])if(layers[key]){g.fillStyle=ink;g.font="20px Arial";g.fillText(t("✓ ")+t(name),X0,y);y+=30;}
  y+=20;for(const key of layers.surface?["green","water","hard","bare","building"]:[]){const area=Number(areas[key]||0)+(key==="water"?Number(areas.pool||0):0);if(area<=0&&key!=="green"&&key!=="water")continue;g.fillStyle=colors[key]||colors.other;g.fillRect(X0,y,34,34);g.fillStyle=ink;g.font="bold 24px Arial";g.fillText(t(labelForClass(key)),X0+48,y+18);g.fillStyle=muted;g.font="22px Arial";g.fillText(ha(area)+t(" ha"),X0+48,y+44);y+=76;}
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.beginPath();g.moveTo(X0,y+6);g.lineTo(width-40,y+6);g.stroke();g.fillStyle="#1d6b3c";g.font="bold 22px Arial";g.fillText(t("Bu harita raster sınıfları ve"),X0,y+44,width-X0-40);g.fillText(t("park içi analiz katmanlarını gösterir."),X0,y+74,width-X0-40);g.fillText(t("Ham raster kaynak veride korunur."),X0,y+104,width-X0-40);
  g.fillStyle=green;g.fillRect(0,height-70,width,70);g.fillStyle="#cfe3d3";g.font="19px Arial";g.fillText(t(footerNote),40,height-54,width-80);g.fillText(t("Raster: ESA WorldCover 2021 v200 (CC BY 4.0) · parmak izi ")+String(fingerprint||"").slice(0,8)+t(" · CC BY-NC 4.0"),40,height-26,width-80);
 }
 root.DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC=Object.freeze({render});
})(window);
