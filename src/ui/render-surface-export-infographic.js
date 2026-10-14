"use strict";
/* Paint branded title, reviewed-area summary, legend and source footer. */
(function(root){
 function render({context,width,height,green,muted,ink,colors,park,parkDate,decisionCount,viewLabel,parkAreaLabel,edits,layers,areas,ha,labelForClass,fingerprint}){
  const g=context,X0=840;
  g.fillStyle=green;g.fillRect(0,0,width,120);g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText("DENDROGEO",40,72);g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText("Küresel Ağaç Envanteri ve Karbon Veri Sistemi",40,102);g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText("dendrogeo.org",width-40,70);g.textAlign="left";
  g.fillStyle=green;g.font="bold 32px Arial";g.fillText("DOĞRULANMIŞ PARK HARİTASI",40,172);g.fillStyle=muted;g.font="22px Arial";g.fillText((park.name||"Park")+" · "+parkDate+" · "+decisionCount+" karar · "+viewLabel,40,206);
  g.fillStyle=muted;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X0,300);g.fillStyle=ink;g.font="bold 54px Arial";g.fillText(parkAreaLabel+" ha",X0,352);g.fillStyle=muted;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X0,420,width-X0-40);g.fillStyle=ink;g.font="bold 54px Arial";g.fillText(String(edits.total),X0,472);g.fillStyle=muted;g.font="18px Arial";g.fillText((edits.manualCells+edits.sensitivityCells)+" hücre · "+edits.boundaries+" sınır · "+edits.thresholds+" eşik · "+edits.appearance+" görünüm",X0,508,width-X0-40);
  g.fillStyle=muted;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X0,540);let y=580;
  for(const [key,name] of [["park","Park alanı"],["surface","Park analizi"],["grid","Gridler"],["waypoints","Waypointler"]])if(layers[key]){g.fillStyle=ink;g.font="20px Arial";g.fillText("✓ "+name,X0,y);y+=30;}
  y+=20;for(const key of layers.surface?["green","water","hard","bare","building"]:[]){const area=Number(areas[key]||0)+(key==="water"?Number(areas.pool||0):0);if(area<=0&&key!=="green"&&key!=="water")continue;g.fillStyle=colors[key]||colors.other;g.fillRect(X0,y,34,34);g.fillStyle=ink;g.font="bold 24px Arial";g.fillText(labelForClass(key),X0+48,y+18);g.fillStyle=muted;g.font="22px Arial";g.fillText(ha(area)+" ha",X0+48,y+44);y+=76;}
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.beginPath();g.moveTo(X0,y+6);g.lineTo(width-40,y+6);g.stroke();g.fillStyle="#1d6b3c";g.font="bold 22px Arial";g.fillText("Bu harita raster + kullanıcı kararlarının",X0,y+44,width-X0-40);g.fillText("birleşimidir; ham raster sonucu",X0,y+74,width-X0-40);g.fillText("kaynak veride değişmeden korunur.",X0,y+104,width-X0-40);
  g.fillStyle=green;g.fillRect(0,height-70,width,70);g.fillStyle="#cfe3d3";g.font="19px Arial";g.fillText("Kesin hücre geometrisi; kullanıcı düzeltmeleri ayrıca kaydedilir.",40,height-54,width-80);g.fillText("Raster: ESA WorldCover 2021 v200 (CC BY 4.0) · parmak izi "+String(fingerprint||"").slice(0,8)+" · CC BY-NC 4.0",40,height-26,width-80);
 }
 root.DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC=Object.freeze({render});
})(window);
