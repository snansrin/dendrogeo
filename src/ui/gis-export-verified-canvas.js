"use strict";
/* Draw the reviewed surface and relative-NDVI layers on the verified GIS map. */
(function(root){
 function draw({context:g,layout,layers,sensitivity,record,tiers,ndviPolys,parkRings,holes,
  decisionCount,areas,parkName,classes,canvasApi,getLandcover,readProjectId,getGridCells,
  getWaypoints,getLastWaypoints,hasParkAreaHa,getParkAreaHa,getSurfaceTypes,formatArea,outline,color}){
  const {CW,CH,MX,MY,MW,MH,projector:pr}=layout;
  const GREEN="#14532d",MUT="#5c6a63",INK="#182420";
  root.DG_GIS_EXPORT_VERIFIED_FRAME.drawHeader({g,CW,CH,parkName,decisionCount,sensitivity});
  g.fillStyle="#fff";g.fillRect(MX,MY,MW,MH);
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.strokeRect(MX,MY,MW,MH);
  g.save();g.beginPath();
  for(const ring of parkRings)outline(g,pr,ring);
  for(const ring of holes)outline(g,pr,ring);
  g.clip("evenodd");
  let painted=0;
  if(layers.surface){
   for(const item of sensitivity.displayPaths||[])
    if(canvasApi.drawLeaflet(g,pr,item.poly,Math.max(.28,(sensitivity.opacity||65)/100)))painted++;
   if(!painted){const landcover=getLandcover();painted=canvasApi.drawRawPatches(g,pr,landcover?.patches||landcover?.report?.patches||[],classes);}
   // NDVI follows the reviewed surface so only observed green cells get tiers.
   if(!painted)return{ok:false,message:"Arazi örtüsü çizilemedi; NDVI katmanı tek başına doğrulanmış harita sayılmaz."};
   for(const poly of ndviPolys)
    if(canvasApi.drawLeaflet(g,pr,poly,Math.max(.45,(sensitivity.opacity||65)/100)))painted++;
  }
  if(layers.grid){const cells=getGridCells();if(cells!==null)canvasApi.drawVerifiedGrid(g,pr,cells,GREEN);}
  if(layers.waypoints){
   const pid=readProjectId();
   const points=[...getLastWaypoints(),...getWaypoints()];
   const unique=new Map(points.filter(w=>Number.isFinite(Number(w.lat))&&Number.isFinite(Number(w.lon))&&(!w.project_id||Number(w.project_id)===pid))
    .map(w=>[String(w.project_id||pid)+":"+String(w.wp_id??w.id),w]));
   canvasApi.drawVerifiedWaypoints(g,pr,[...unique.values()],INK);
  }
  g.restore();
  if(layers.park){
   g.beginPath();
   for(const ring of parkRings)outline(g,pr,ring);
   for(const ring of holes)outline(g,pr,ring);
   g.strokeStyle="#111827";g.lineWidth=2.5;g.stroke();
  }
  if(layers.surface&&!painted)return{ok:false,message:"Doğrulanmış arazi örtüsü geometrisi çizilemedi. Yanıltıcı PNG oluşturulmadı."};
  const X0=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X0,300);
  const parkHa=hasParkAreaHa()?getParkAreaHa():Object.values(areas).reduce((a,n)=>a+Number(n||0),0)/10000;
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(Number(parkHa).toFixed(1)+" ha",X0,352);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X0,420,CW-X0-40);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(String(decisionCount),X0,472);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X0,540);
  let y=572;
  if(layers.surface)for(const k of ["green","water","hard","bare","building","pool"]){
   const v=Number(areas[k]||0);
   if(v<=0)continue;
   const label=getSurfaceTypes()?.[k]?.label||classes[k]?.label||k;
   g.fillStyle=color(k);g.fillRect(X0,y,26,26);
   g.fillStyle=INK;g.font="bold 19px Arial";g.fillText(label,X0+39,y+20,CW-X0-70);
   g.fillStyle=MUT;g.font="18px Arial";g.fillText(formatArea(v/10000)+" ha",X0+39,y+44,CW-X0-70);
   y+=67;
  }
  y+=16;g.strokeStyle="#dfe5df";g.lineWidth=2;g.beginPath();g.moveTo(X0,y);g.lineTo(CW-40,y);g.stroke();y+=35;
  g.fillStyle=GREEN;g.font="bold 19px Arial";g.fillText("GÖRELİ NDVI · YEŞİL ALAN",X0,y,CW-X0-35);y+=20;
  const counts={sparse:0,moderate:0,dense:0};
  for(const tier of tiers.tiers.values())if(tier in counts)counts[tier]++;
  for(const [key,label] of [["sparse","Seyrek"],["moderate","Orta"],["dense","Yoğun"]]){
   y+=18;g.fillStyle=color(key);g.fillRect(X0,y,22,22);
   g.fillStyle=INK;g.font="19px Arial";g.fillText(label+": "+counts[key]+" hücre",X0+36,y+18,CW-X0-70);
  }
  y+=54;g.fillStyle=MUT;g.font="17px Arial";
  g.fillText("Uygun hücre: "+tiers.count+" / "+tiers.eligible,X0,y,CW-X0-40);
  y+=26;g.fillText("Eşikler: "+tiers.cutoffs.map(n=>Number(n).toFixed(3)).join(" / "),X0,y,CW-X0-40);
  y+=30;g.font="15px Arial";g.fillText("Park içi göreli sınıflama; taç örtüsü",X0,y,CW-X0-40);
  y+=22;g.fillText("ölçümü değildir. ≥3 gözlem/hücre.",X0,y,CW-X0-40);
  root.DG_GIS_EXPORT_VERIFIED_FRAME.drawFooter({g,CW,CH,record});
  return{ok:true};
 }
 root.DG_GIS_EXPORT_VERIFIED_CANVAS=Object.freeze({draw});
})(window);
