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
  const parkHa=hasParkAreaHa()?getParkAreaHa():Object.values(areas).reduce((a,n)=>a+Number(n||0),0)/10000;
  root.DG_GIS_EXPORT_VERIFIED_SUMMARY.draw({g,CW,parkHa,decisionCount,areas,layers,tiers,classes,
   getSurfaceTypes,formatArea,color});
  root.DG_GIS_EXPORT_VERIFIED_FRAME.drawFooter({g,CW,CH,record});
  return{ok:true};
 }
 root.DG_GIS_EXPORT_VERIFIED_CANVAS=Object.freeze({draw});
})(window);
