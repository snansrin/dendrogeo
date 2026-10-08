/* DendroGeo GIS output compatibility · UI/export-only, 2026-10-08.
 * Scientific lock: NO changes to original 51 frozen source files.
 * (1) Adapt the legacy PDF/PNG class lookup after lazy WorldCover loading.
 * (2) Render the exact current relative-NDVI display in verified PNG, if eligible.
 * No calculation, classification, persisted record or histogram is modified. */
(function(){
 "use strict";
 const ROOT=window;
 function classes(){
  try{
   const list=(typeof DG_LC_CLASSES!=="undefined")?DG_LC_CLASSES:null;
   return Array.isArray(list)?list:[];
  }catch(e){return[];}
 }
 function repairLegacyPng(){
  // The frozen park-export script captures runLandCoverAnalysis as its
  // DG_LC_CLASSES_SAF fallback, before the lazy class table is loaded.
  // Add only the missing Array.find-compatible lookup to that function object.
  // Its invocation and all analysis paths remain unchanged.
  if(typeof DG_LC_CLASSES_SAF==="undefined"||Array.isArray(DG_LC_CLASSES_SAF))return true;
  const value=DG_LC_CLASSES_SAF;
  if(typeof value!=="function"||typeof value.find==="function")return typeof value?.find==="function";
  Object.defineProperty(value,"find",{
   configurable:true,
   value:function(predicate){return classes().find(predicate);}
  });
  return true;
 }
 function available(){
  return typeof DG_SENS!=="undefined"&&!!DG_SENS.record&&!!DG_SENS.vegetationView&&
   typeof dgSensVegetationTiers==="function"&&typeof dgSensVisualResult==="function";
 }
 function validation(layers){
  if(!available()||!layers.surface)return null;
  if(DG_SENS.busy||DG_SENS.saving||DG_SENS.exporting||!DG_SENS.geometry)return null;
  const tiers=dgSensVegetationTiers();
  if(tiers.count<9||tiers.tiers.size<9)return null;
  return tiers;
 }
 function drawPolygon(ctx,rings,project){
  ctx.beginPath();
  for(const ring of rings||[]){
   if(!Array.isArray(ring)||ring.length<3)continue;
   for(let i=0;i<ring.length;i++){
    const p=project(ring[i]);
    if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);
   }
   ctx.closePath();
  }
  ctx.fill("evenodd");
 }
 function formatHa(n){return (Number(n||0)/10000).toFixed(3)+" ha";}
 function downloads(rows){
  const projectId=Number(document.getElementById("gridProject")?.value);
  const wps=[...(typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[]),...(typeof WP!=="undefined"?WP:[])];
  return [...new Map(wps.filter(w=>Number.isFinite(Number(w.lat))&&Number.isFinite(Number(w.lon))&&
   (!w.project_id||Number(w.project_id)===projectId))
   .map(w=>[String(w.project_id||projectId)+":"+String(w.wp_id??w.id),w])).values()];
 }
 async function renderNDVI(layers,tiers){
  const epoch=DG_SENS.epoch,rec=DG_SENS.record,cells=dgSensCells();
  if(!rec||!cells?.length)return;
  const edits=dgSensEditSummary(rec);
  if(layers.surface&&!edits.total&&!rec.acceptedAt&&!dgSensFeatures().length){
   toast("Doğrulanmış harita için önce kararları kabul edin veya kaydedin.","warn","🖼️");return;
  }
  const epsg=DG_SENS.epsg||dgLcUtmEpsgForLatLon(cells[0].center.lat,cells[0].center.lon);
  const parts=dgSensParts(),job=await dgSensVisualResult(parts);
  if(epoch!==DG_SENS.epoch||rec!==DG_SENS.record)return;
  const features=job?.displayFeatures||dgSurfaceDisplaySync(parts,epsg,DG_SENS.parkGeometry);
  const area=dgSensAreas()||dgSensGroupAreas(),pk=dgSensParkId();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const utm=(lat,lon)=>dgLcUtmForward(lat,lon,epsg);
  const expand=(q)=>{const z=utm(q[1],q[0]);minX=Math.min(minX,z.x);maxX=Math.max(maxX,z.x);minY=Math.min(minY,z.y);maxY=Math.max(maxY,z.y);};
  for(const c of cells)for(const q of c.quadWgs||[])expand(q);
  for(const ring of (typeof PARK_POLY!=="undefined"?PARK_POLY:[])||[])for(const p of ring)expand([p[1],p[0]]);
  if(!Number.isFinite(minX)||!Number.isFinite(maxX)||maxX-minX<=0||maxY-minY<=0)return;
  const cv=document.createElement("canvas"),CW=1240,CH=1560;
  cv.width=CW;cv.height=CH;
  const g=cv.getContext("2d");if(!g)return;
  const GREEN="#14532d",MUT="#5c6a63",INK="#182420",BG="#f7f6f2";
  const palette=Object.assign({green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b",building:"#475569",pool:"#0ea5e9",other:"#94a3b8"},
   typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS:{});
  const veg=Object.assign({sparse:"#b7e4a8",moderate:"#4caf66",dense:"#14532d"},
   typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS:{});
  const MX=40,MY=240,MW=760,MH=1180;
  const scale=Math.min((MW-40)/(maxX-minX),(MH-40)/(maxY-minY));
  const ox=MX+(MW-(maxX-minX)*scale)/2,oy=MY+(MH-(maxY-minY)*scale)/2;
  const px=(z)=>[ox+(z.x-minX)*scale,oy+(maxY-z.y)*scale];
  const projectWgs=q=>px(utm(q[1],q[0]));
  const projectUtm=q=>px({x:q[0],y:q[1]});
  g.fillStyle=BG;g.fillRect(0,0,CW,CH);
  g.fillStyle=GREEN;g.fillRect(0,0,CW,120);
  g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText("DENDROGEO",40,72);
  g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText("Küresel Ağaç Envanteri ve Karbon Veri Sistemi",40,102);
  g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText("dendrogeo.org",CW-40,70);g.textAlign="left";
  g.fillStyle=GREEN;g.font="bold 32px Arial";g.fillText("DOĞRULANMIŞ PARK HARİTASI",40,172);
  g.fillStyle=MUT;g.font="22px Arial";
  g.fillText((pk.name||"Park")+" · "+new Date().toISOString().slice(0,10)+" · "+edits.total+" karar · "+(DG_SENS.editing?"ÖNİZLEME":"KABUL EDİLMİŞ v"+(rec.serverRevision||1)),40,206);
  g.fillStyle="#fff";g.fillRect(MX,MY,MW,MH);
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.strokeRect(MX,MY,MW,MH);
  g.save();g.beginPath();g.rect(MX,MY,MW,MH);g.clip();
  if(layers.surface)for(const feature of features){
   g.fillStyle=palette[feature.properties.class]||palette.other;
   for(const poly of feature.geometry?.coordinates||[])drawPolygon(g,poly,projectWgs);
  }
  // Apply only observed NDVI terciles, in the exact reviewed GREEN cell geometry.
  // The classification itself is not changed; cells without evidence stay green.
  let painted=0;
  for(const [key,tier] of tiers.tiers){
   if(!["sparse","moderate","dense"].includes(tier))continue;
   const polygons=DG_SENS.geometry[key];
   if(!Array.isArray(polygons)||!polygons.length)continue;
   g.fillStyle=veg[tier];
   for(const poly of polygons)drawPolygon(g,poly,projectUtm);
   painted++;
  }
  if(layers.park&&typeof PARK_POLY!=="undefined"&&PARK_POLY){
   g.strokeStyle="#111827";g.lineWidth=2.5;g.beginPath();
   for(const ring of [...PARK_POLY,...(typeof PARK_HOLES!=="undefined"?PARK_HOLES:[])]){
    ring.forEach((q,i)=>{const p=px(utm(q[0],q[1]));i?g.lineTo(...p):g.moveTo(...p);});g.closePath();
   }g.stroke();
  }
  if(layers.grid&&typeof GRID_CELLS!=="undefined")for(const c of GRID_CELLS){
   g.strokeStyle=GREEN;g.lineWidth=1;g.beginPath();
   for(const poly of c.geometry?.coordinates||[])for(const ring of poly){
    ring.forEach((q,i)=>{const p=projectWgs(q);i?g.lineTo(...p):g.moveTo(...p);});g.closePath();
   }g.stroke();
  }
  if(layers.waypoints)for(const w of downloads()){
   const p=px(utm(Number(w.lat),Number(w.lon)));
   g.beginPath();g.arc(...p,7,0,Math.PI*2);g.fillStyle=w.visited?"#22c55e":"#ef4444";g.fill();
   g.strokeStyle="#fff";g.lineWidth=2;g.stroke();g.fillStyle=INK;g.font="bold 14px Arial";
   g.fillText(String(w.wp_id??w.id??""),p[0]+10,p[1]+4);
  }
  g.restore();
  const X=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X,295);
  g.fillStyle=INK;g.font="bold 52px Arial";g.fillText((typeof parkAreaHa==="function"?parkAreaHa().toFixed(1):"—")+" ha",X,345);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X,403,CW-X-40);
  g.fillStyle=INK;g.font="bold 48px Arial";g.fillText(String(edits.total),X,452);
  g.fillStyle=MUT;g.font="17px Arial";
  g.fillText((edits.manualCells+edits.sensitivityCells)+" hücre · "+edits.boundaries+" sınır",X,484,CW-X-40);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X,530,CW-X-40);
  let y=563;
  for(const k of ["green","water","hard","bare","building","pool"]){
   if(!layers.surface)break;
   const v=Number(area[k]||0);
   if(v<=0&&k!=="green"&&k!=="water")continue;
   const label=typeof DG_SURFACE_REVIEW!=="undefined"&&DG_SURFACE_REVIEW.types?.[k]?.label||k;
   g.fillStyle=palette[k]||palette.other;g.fillRect(X,y,26,26);
   g.fillStyle=INK;g.font="bold 20px Arial";g.fillText(label,X+38,y+20,CW-X-80);
   g.fillStyle=MUT;g.font="18px Arial";g.fillText(formatHa(v),X+38,y+43);
   y+=65;
  }
  y=Math.max(y+12,985);
  g.strokeStyle="#dfe5df";g.beginPath();g.moveTo(X,y);g.lineTo(CW-40,y);g.stroke();
  y+=34;
  g.fillStyle=GREEN;g.font="bold 21px Arial";g.fillText("GÖRELİ NDVI · YEŞİL ALAN",X,y,CW-X-40);
  y+=29;
  g.fillStyle=MUT;g.font="16px Arial";
  g.fillText(painted+" hücre · 3+ açık gözlem",X,y,CW-X-40);
  for(const [tier,label] of [["sparse","Seyrek NDVI"],["moderate","Orta NDVI"],["dense","Yoğun NDVI"]]){
   y+=38;g.fillStyle=veg[tier];g.fillRect(X,y-18,24,24);
   g.fillStyle=INK;g.font="18px Arial";g.fillText(label,X+34,y,CW-X-80);
  }
  if(tiers.cutoffs){y+=30;g.fillStyle=MUT;g.font="16px Arial";
   g.fillText("Terciller: "+tiers.cutoffs.map(n=>n.toFixed(2)).join(" / "),X,y,CW-X-55);
  }
  y+=35;g.fillStyle=MUT;g.font="16px Arial";
  g.fillText("Görselleştirme; taç örtüsü veya",X,y,CW-X-55);
  g.fillText("yeni arazi sınıfı değildir.",X,y+22,CW-X-55);
  g.fillStyle=GREEN;g.fillRect(0,CH-70,CW,70);
  g.fillStyle="#cfe3d3";g.font="18px Arial";
  g.fillText("Alan hesapları değiştirilmedi. NDVI yalnız kanıt bulunan yeşil hücreleri renklendirir.",40,CH-51,CW-80);
  g.fillText("Raster: ESA WorldCover 2021 v200 · kaynak parmak izi "+String(rec.fingerprint||"").slice(0,8)+" · dendrogeo.org",40,CH-25,CW-80);
  if(epoch!==DG_SENS.epoch||rec!==DG_SENS.record)return;
  await new Promise((resolve,reject)=>cv.toBlob(blob=>{
   if(!blob){reject(new Error("PNG görüntüsü üretilemedi."));return;}
   try{
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="dendrogeo_dogrulanmis_harita_ndvi_"+(pk.id||"park")+".png";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    resolve();
   }catch(err){reject(err);}
  },"image/png"));
  toast("✓ Göreli NDVI katmanlı doğrulanmış harita indirildi.","ok","🖼️");
 }
 function handleExport(event){
  const button=event.target?.closest?.("#dgExportDownload");
  if(!button||!available())return;
  const dialog=button.closest("dialog");if(!dialog)return;
  const layers=Object.fromEntries(["park","surface","grid","waypoints"].map(k=>[k,!!dialog.querySelector('[name="'+k+'"]')?.checked]));
  if(!layers.surface)return; // Preserve frozen default export for ordinary maps.
  const tiers=validation(layers);
  if(!tiers){
   // No approved spectral data => never invent tercile colors.
   toast("Göreli NDVI için en az 9 yeşil hücrede 3+ açık uydu gözlemi gerekli. Normal harita indiriliyor.","info","🛰️",9000);
   return;
  }
  event.preventDefault();event.stopImmediatePropagation();
  dialog.close();
  void renderNDVI(layers,tiers).catch(e=>{
   console.error("DendroGeo · Göreli NDVI PNG:",e);
   toast("Göreli NDVI PNG üretilemedi: "+String(e.message||e),"err","🖼️",10000);
  });
 }
 repairLegacyPng();
 document.addEventListener("click",handleExport,true);
 ROOT.DG_GIS_OUTPUT_COMPAT=Object.freeze({repairLegacyPng,classes});
})();