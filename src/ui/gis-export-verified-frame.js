"use strict";
/* Fixed branded frame for the verified GIS PNG; map layers stay in the canvas adapter. */
(function(root){
 function drawHeader({g,CW,CH,parkName,decisionCount,sensitivity}){
  const GREEN="#14532d",MUT="#5c6a63",BG="#f7f6f2";
  g.fillStyle=BG;g.fillRect(0,0,CW,CH);
  g.fillStyle=GREEN;g.fillRect(0,0,CW,120);
  g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText("DENDROGEO",40,72);
  g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText("Küresel Ağaç Envanteri ve Karbon Veri Sistemi",40,102);
  g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText("dendrogeo.org",CW-40,70);g.textAlign="left";
  g.fillStyle=GREEN;g.font="bold 32px Arial";g.fillText("DOĞRULANMIŞ PARK HARİTASI",40,172);
  g.fillStyle=MUT;g.font="20px Arial";
  g.fillText(parkName+" · "+new Date().toISOString().slice(0,10)+" · "+decisionCount+" karar · "+(sensitivity.editing?"ÖNİZLEME":"KABUL EDİLMİŞ"),40,206,1150);
 }
 function drawFooter({g,CW,CH,record}){
  const GREEN="#14532d";
  g.fillStyle=GREEN;g.fillRect(0,CH-70,CW,70);
  g.fillStyle="#cfe3d3";g.font="19px Arial";
  g.fillText("Raster ve doğrulanmış yüzey sınıfları; NDVI yeşil alanda görsel karşılaştırmadır.",40,CH-54,CW-80);
  g.fillText("ESA WorldCover 2021 v200 (CC BY 4.0) · "+String(record.fingerprint||"").slice(0,8)+" · CC BY-NC 4.0",40,CH-26,CW-80);
 }
 root.DG_GIS_EXPORT_VERIFIED_FRAME=Object.freeze({drawHeader,drawFooter});
})(window);
