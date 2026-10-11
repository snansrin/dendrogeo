/* Canvas rendering helpers for GIS PNG exports. */
(function(root){
 "use strict";
 function eachRing(tree,visit){
  if(!Array.isArray(tree)||!tree.length)return;
  if(tree[0]&&typeof tree[0].lat==="number"&&typeof tree[0].lng==="number"){visit(tree);return;}
  for(const child of tree)eachRing(child,visit);
 }
 function drawLeaflet(context,projector,layer,opacity=0.6){
  const rings=[];
  if(typeof layer?.getLatLngs!=="function")return false;
  eachRing(layer.getLatLngs(),ring=>rings.push(ring));
  if(!rings.length)return false;
  context.beginPath();
  for(const ring of rings){
   ring.forEach((point,index)=>{
    const x=projector.x(point.lng),y=projector.y(point.lat);
    if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
   });
   context.closePath();
  }
  context.fillStyle=layer.options?.fillColor||layer.options?.color||"#94a3b8";
  context.globalAlpha=Math.min(1,Math.max(0,opacity));
  context.fill("evenodd");
  context.globalAlpha=1;
  return true;
 }
 function drawRawPatches(context,projector,patches,classes){
  let painted=0;
  for(const patch of patches||[]){
   const rings=patch.rings||[];
   if(!rings.length)continue;
   context.beginPath();
   for(const ring of rings){
    ring.forEach((point,index)=>{
     const x=projector.x(point[1]),y=projector.y(point[0]);
     if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
    });
    context.closePath();
   }
   context.globalAlpha=.52;
   context.fillStyle=classes[patch.classKey||patch.group]?.color||"#94a3b8";
   context.fill("evenodd");
   context.globalAlpha=1;
   painted++;
  }
  return painted;
 }
 function drawGrid(context,projector,cells){
  context.lineWidth=1;context.strokeStyle="#166534";
  for(const cell of cells||[]){
   if(![cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite))continue;
   context.strokeRect(projector.x(cell.w0),projector.y(cell.s1),
    projector.x(cell.w1)-projector.x(cell.w0),projector.y(cell.s0)-projector.y(cell.s1));
  }
 }
 function drawWaypoints(context,projector,waypoints){
  for(const waypoint of waypoints||[]){
   if(!Number.isFinite(waypoint.lat)||!Number.isFinite(waypoint.lon))continue;
   context.fillStyle=waypoint.visited?"#16a34a":"#e11d48";
   context.beginPath();context.arc(projector.x(waypoint.lon),projector.y(waypoint.lat),5,0,Math.PI*2);context.fill();
   context.strokeStyle="#fff";context.lineWidth=1.7;context.stroke();
  }
 }
 function drawVerifiedGrid(context,projector,cells,color){
  for(const cell of cells||[]){
   if(Array.isArray(cell.geometry?.coordinates)){
    for(const polygon of cell.geometry.coordinates)for(const ring of polygon){
     context.beginPath();ring.forEach((point,index)=>{
      if(index)context.lineTo(projector.x(point[0]),projector.y(point[1]));
      else context.moveTo(projector.x(point[0]),projector.y(point[1]));
     });
     context.closePath();context.strokeStyle=color;context.lineWidth=1;context.stroke();
    }
   }else if([cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite)){
    context.strokeStyle=color;context.lineWidth=1;
    context.strokeRect(projector.x(cell.w0),projector.y(cell.s1),
     projector.x(cell.w1)-projector.x(cell.w0),projector.y(cell.s0)-projector.y(cell.s1));
   }
  }
 }
 function drawVerifiedWaypoints(context,projector,waypoints,ink){
  for(const waypoint of waypoints||[]){
   const x=projector.x(Number(waypoint.lon)),y=projector.y(Number(waypoint.lat));
   context.beginPath();context.arc(x,y,7,0,Math.PI*2);
   context.fillStyle=waypoint.visited?"#22c55e":"#ef4444";context.fill();
   context.strokeStyle="#fff";context.lineWidth=2;context.stroke();
   context.fillStyle=ink;context.font="bold 14px Arial";
   context.fillText(String(waypoint.wp_id??waypoint.id??""),x+10,y+4);
  }
 }
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
 root.DG_GIS_EXPORT_CANVAS=Object.freeze({eachRing,drawLeaflet,drawRawPatches,drawGrid,drawWaypoints,drawVerifiedGrid,drawVerifiedWaypoints,drawLegend});
})(window);
