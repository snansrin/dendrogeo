/* DendroGeo verified-map PNG export (presentation only, 2026-10-08).
 * Sidecar for the locked surface engine. Reads current Leaflet display
 * geometries and optional park-relative NDVI polygons, never writes analysis.
 * Does not use cross-origin tile screenshots or alter approved records. */
(function(){
 "use strict";
 const read=id=>document.getElementById(id);
 const notify=(s,type="info")=>{if(typeof toast==="function")toast(s,type,"🖼️");};
 const PALETTE={
  green:{color:"#4ade80",label:"Yeşil alan"},
  water:{color:"#3b82f6",label:"Su"},
  hard:{color:"#64748b",label:"Sert zemin"},
  bare:{color:"#8b5a2b",label:"Çıplak zemin"},
  other:{color:"#94a3b8",label:"Diğer"}
 };
 function classes(){
  // DG_LC_CLASSES is loaded lazily, so never capture it at startup.
  if(typeof DG_LC_CLASSES!=="undefined"&&Array.isArray(DG_LC_CLASSES))
   return Object.fromEntries(DG_LC_CLASSES.map(x=>[x.key,{color:x.color,label:x.label}]));
  return PALETTE;
 }
 function eachRing(tree,visit){
  if(!Array.isArray(tree)||!tree.length)return;
  if(tree[0]&&typeof tree[0].lat==="number"&&typeof tree[0].lng==="number"){visit(tree);return;}
  for(const child of tree)eachRing(child,visit);
 }
 function drawLeaflet(ctx,pr,layer,opacity=0.6){
  const rings=[];
  if(typeof layer?.getLatLngs!=="function")return false;
  eachRing(layer.getLatLngs(),ring=>rings.push(ring));
  if(!rings.length)return false;
  ctx.beginPath();
  for(const ring of rings){
   ring.forEach((p,i)=>{const x=pr.x(p.lng),y=pr.y(p.lat);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
   ctx.closePath();
  }
  ctx.fillStyle=layer.options?.fillColor||layer.options?.color||"#94a3b8";
  ctx.globalAlpha=Math.min(1,Math.max(0,opacity));
  ctx.fill("evenodd");
  ctx.globalAlpha=1;
  return true;
 }
 function drawRawPatches(ctx,pr,patches,dict){
  let painted=0;
  for(const patch of patches||[]){
   const rings=patch.rings||[];
   if(!rings.length)continue;
   ctx.beginPath();
   for(const ring of rings){
    ring.forEach((p,i)=>{const x=pr.x(p[1]),y=pr.y(p[0]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
    ctx.closePath();
   }
   ctx.globalAlpha=.52;
   ctx.fillStyle=dict[patch.classKey||patch.group]?.color||"#94a3b8";
   ctx.fill("evenodd");ctx.globalAlpha=1;painted++;
  }
  return painted;
 }
 function outline(ctx,pr,ring){
  if(!Array.isArray(ring)||!ring.length)return;
  ctx.moveTo(pr.x(ring[0][1]),pr.y(ring[0][0]));
  for(const p of ring.slice(1))ctx.lineTo(pr.x(p[1]),pr.y(p[0]));
  ctx.closePath();
 }
 function pngLayers(sens){
  const result=[];
  if(!sens?.vegetationLayer?.eachLayer)return result;
  sens.vegetationLayer.eachLayer(layer=>{
   if(typeof layer.getLatLngs==="function")result.push(layer);
  });
  return result;
 }
 async function waitVegetation(sens){
  if(!sens?.vegetationView)return[];
  if(typeof dgSensVegetationTiers==="function"){
   const tiers=dgSensVegetationTiers();
   if(!tiers||tiers.count<9)return[];
  }
  let layers=pngLayers(sens);
  if(layers.length)return layers;
  if(typeof dgSensRenderVegetation==="function"){
   try{await dgSensRenderVegetation();}catch(e){}
  }
  // The visible NDVI layer can still be in worker-rendering; wait a bounded time.
  for(let i=0;i<8;i++){
   layers=pngLayers(sens);
   if(layers.length)return layers;
   await new Promise(resolve=>setTimeout(resolve,120));
  }
  return[];
 }
 function fmt(n){return Number(n).toLocaleString("tr-TR",{maximumFractionDigits:2});}
 function safeName(s){return String(s||"park").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,48).toLowerCase();}
 async function render(){
  if(typeof PARK_POLY==="undefined"||!Array.isArray(PARK_POLY)||!PARK_POLY.length){
   notify("Önce bir park seçin.","warn");return false;
  }
  const opts={cover:read("chkPngCover")?.checked!==false,grid:read("chkPngGrid")?.checked!==false,wp:read("chkPngWp")?.checked!==false};
  const sens=window.DG_LC_SENS?.state,ndvi=!!sens?.vegetationView&&!sens.rawView;
  const ndviPolys=ndvi?await waitVegetation(sens):[];
  if(ndvi&&!ndviPolys.length){
   notify("Göreli NDVI açık, ancak gösterilecek en az 3 gözlemli NDVI katmanı hazır değil. Yanlış PNG oluşturmamak için indirme durduruldu.","warn");
   return false;
  }
  const bounds={minLat:90,maxLat:-90,minLon:180,maxLon:-180};
  function grow(p){if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return;
   bounds.minLat=Math.min(bounds.minLat,p[0]);bounds.maxLat=Math.max(bounds.maxLat,p[0]);
   bounds.minLon=Math.min(bounds.minLon,p[1]);bounds.maxLon=Math.max(bounds.maxLon,p[1]);}
  for(const ring of PARK_POLY)for(const p of ring)grow(p);
  if(bounds.maxLat<=bounds.minLat||bounds.maxLon<=bounds.minLon){notify("Park geometrisi geçersiz, PNG oluşturulmadı.","err");return false;}
  const centerLat=(bounds.minLat+bounds.maxLat)/2;
  const mx=111320*Math.cos(centerLat*Math.PI/180),my=110540;
  const wMeters=(bounds.maxLon-bounds.minLon)*mx+30,hMeters=(bounds.maxLat-bounds.minLat)*my+30;
  const PAD=76,TOP=110,LEGEND=146;
  const scale=Math.min((1600-PAD*2)/wMeters,(1200-PAD*2)/hMeters);
  const W=Math.max(940,Math.ceil(wMeters*scale+PAD*2));
  const H=Math.ceil(hMeters*scale+TOP+PAD+LEGEND);
  const lon0=(bounds.minLon+bounds.maxLon)/2;
  const pr={x:lon=>W/2+(lon-lon0)*mx*scale,y:lat=>TOP+(bounds.maxLat+15/my-lat)*my*scale};
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");if(!ctx){notify("Bu tarayıcı PNG oluşturmayı desteklemiyor.","err");return false;}
  const dict=classes();
  ctx.fillStyle="#f7f6f2";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#d4ded5";ctx.strokeRect(12,12,W-24,H-24);
  ctx.font="bold 25px system-ui,sans-serif";ctx.fillStyle="#14532d";ctx.fillText("DendroGeo · Doğrulanmış Harita",PAD,44);
  ctx.font="14px system-ui,sans-serif";ctx.fillStyle="#475569";
  ctx.fillText((typeof DG_PARK!=="undefined"&&DG_PARK?.name?DG_PARK.name:"Park analizi")+(ndvi?" · Göreli NDVI açık":""),PAD,69);
  ctx.fillText("Katmanlar: "+(ndvi?"Park yüzeyi + göreli NDVI":"Park yüzeyi")+
   "  |  "+new Date().toLocaleString("tr-TR"),PAD,91);
  ctx.save();ctx.beginPath();
  for(const ring of PARK_POLY)outline(ctx,pr,ring);
  if(typeof PARK_HOLES!=="undefined")for(const ring of PARK_HOLES||[])outline(ctx,pr,ring);
  ctx.clip("evenodd");
  let count=0;
  if(opts.cover){
   const display=Array.isArray(sens?.displayPaths)&&!sens.rawView?sens.displayPaths:[];
   if(display.length){
    for(const item of display){
     if(drawLeaflet(ctx,pr,item.poly,Math.max(.28,(sens.opacity||65)/100)))count++;
    }
   }else{
    const last=window.DG_LANDCOVER?.getLast?.();
    count+=drawRawPatches(ctx,pr,last?.patches||last?.report?.patches||[],dict);
   }
  }
  if(ndvi){
   for(const layer of ndviPolys)drawLeaflet(ctx,pr,layer,Math.max(.28,(sens?.opacity||65)/100));
  }
  if(opts.grid&&typeof GRID_CELLS!=="undefined"){
   ctx.lineWidth=1;ctx.strokeStyle="#166534";
   for(const cell of GRID_CELLS||[]){
    if(![cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite))continue;
    ctx.strokeRect(pr.x(cell.w0),pr.y(cell.s1),pr.x(cell.w1)-pr.x(cell.w0),pr.y(cell.s0)-pr.y(cell.s1));
   }
  }
  if(opts.wp&&typeof WP!=="undefined"){
   for(const wp of WP||[]){
    if(!Number.isFinite(wp.lat)||!Number.isFinite(wp.lon))continue;
    ctx.fillStyle=wp.visited?"#16a34a":"#e11d48";
    ctx.beginPath();ctx.arc(pr.x(wp.lon),pr.y(wp.lat),5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=1.7;ctx.stroke();
   }
  }
  ctx.restore();
  ctx.strokeStyle="#166534";ctx.lineWidth=2;ctx.setLineDash([9,5]);
  for(const ring of PARK_POLY){ctx.beginPath();outline(ctx,pr,ring);ctx.stroke();}
  ctx.setLineDash([]);
  const y=H-LEGEND+26;
  ctx.fillStyle="#fff";ctx.fillRect(PAD-10,y-26,W-2*PAD+20,LEGEND-40);
  ctx.font="bold 14px system-ui,sans-serif";ctx.fillStyle="#14532d";
  ctx.fillText(ndvi?"Göreli NDVI · park içi üçlü yeşillik sınıfı":"Arazi örtüsü sınıfları",PAD,y);
  const swatches=ndvi?
   [["Seyrek",typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS.sparse:"#fde68a"],
    ["Orta",typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS.moderate:"#4ade80"],
    ["Yoğun",typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS.dense:"#166534"]]:
   ["green","water","hard","bare"].map(k=>[dict[k]?.label||k,dict[k]?.color||"#94a3b8"]);
  let x=PAD;for(const [label,color] of swatches){
   ctx.fillStyle=color;ctx.fillRect(x,y+17,15,12);ctx.fillStyle="#334155";
   ctx.font="13px system-ui,sans-serif";ctx.fillText(label,x+20,y+28);
   x+=Math.max(116,ctx.measureText(label).width+46);
  }
  ctx.fillStyle="#64748b";ctx.font="11px system-ui,sans-serif";
  ctx.fillText(ndvi?"Göreli NDVI park içi karşılaştırmadır; mutlak taç örtüsü ölçümü değildir.":"Kaynak: ESA WorldCover 2021 v200 · OSM sınırı",PAD,H-58);
  ctx.fillText("© OpenStreetMap katkıcıları (ODbL) · © ESA WorldCover (CC BY 4.0) · DendroGeo",PAD,H-39);
  ctx.fillText("Çıktı görselleştirmedir; kayıtlı bilimsel sonucun yerine geçmez.",PAD,H-20);
  if(!count&&!ndvi){notify("Bu park için çizilecek yüzey geometrisi henüz hazırlanmadı. Önce analizi açın.","warn");return false;}
  return await new Promise(resolve=>cv.toBlob(blob=>{
   if(!blob){notify("PNG üretilemedi.","err");resolve(false);return;}
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");link.href=url;
   link.download="dendrogeo_"+safeName(typeof DG_PARK!=="undefined"?DG_PARK?.name:"park")+
    (ndvi?"_goreli_ndvi":"_dogrulanmis_harita")+"_"+new Date().toISOString().slice(0,10)+".png";
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   notify("PNG indirildi"+(ndvi?" · Göreli NDVI katmanı dahil":""),"ok");resolve(true);
  },"image/png"));
 }
 async function exportMap(){
  try{return await render();}
  catch(error){console.error("DendroGeo PNG dışa aktarım:",error);notify("PNG oluşturulamadı: "+(error?.message||String(error)),"err");return false;}
 }
 window.DG_GIS_PNG_EXPORT={download:exportMap,classes,eachRing};
 window.downloadParkImage=exportMap;
})();