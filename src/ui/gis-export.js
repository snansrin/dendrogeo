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
  building:{color:"#334155",label:"Bina"},
  other:{color:"#94a3b8",label:"Diğer"}
 };
 function classes(){
  // DG_LC_CLASSES is loaded lazily, so never capture it at startup.
  if(typeof DG_LC_CLASSES!=="undefined"&&Array.isArray(DG_LC_CLASSES)){
   const dict=Object.fromEntries(DG_LC_CLASSES.map(x=>[x.key,{color:x.color,label:x.label}]));
   dict.building={...dict.building,color:BUILDING_COLOR,label:dict.building?.label||"Bina"};
   return dict;
  }
  return PALETTE;
 }

 const BUILDING_COLOR="#334155";
 const BASE_URLS={
  osm:(z,x,y)=>"https://tile.openstreetmap.org/"+z+"/"+x+"/"+y+".png",
  sat:(z,x,y)=>"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"+z+"/"+y+"/"+x,
  topo:(z,x,y)=>"https://a.tile.opentopomap.org/"+z+"/"+x+"/"+y+".png"
 };
 const BASE_ATTR={
  vector:"Vektör · DendroGeo",
  osm:"© OpenStreetMap contributors (ODbL)",
  sat:"Tiles © Esri, Maxar, Earthstar Geographics, GIS User Community",
  topo:"© OpenTopoMap (CC BY-SA) · © OpenStreetMap contributors (ODbL)"
 };
 const baseChoice=()=>read("pngBg")?.value||"vector";
 const lonAt=(x,z)=>x/2**z*360-180;
 const latAt=(y,z)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))*180/Math.PI;
 const tileX=(lon,z)=>Math.floor((lon+180)/360*2**z);
 const tileY=(lat,z)=>{
  const rad=Math.max(-85.05,Math.min(85.05,lat))*Math.PI/180;
  return Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*2**z);
 };
 // Area-driven, capped tile mosaic independent of visible screen zoom.
 function baseTilePlan(bounds,mode,maxTiles=48){
  if(mode==="vector")return{mode,z:0,tiles:[]};
  if(!BASE_URLS[mode])throw Error("Bilinmeyen harita altlığı.");
  const {maxLat:north,minLat:south,minLon:west,maxLon:east}=bounds;
  if(![north,south,west,east].every(Number.isFinite)||north<=south||east<=west||
    west < -180||east>180||Math.abs(north)>85.05||Math.abs(south)>85.05)
    throw Error("PNG altlık haritası için park sınırı geçersiz.");
  for(let z=mode==="topo"?17:18;z>=3;z--){
   const x0=tileX(west,z),x1=tileX(east,z),y0=tileY(north,z),y1=tileY(south,z);
   const count=(x1-x0+1)*(y1-y0+1);
   if(count>0&&count<=maxTiles){
    const tiles=[];
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)tiles.push({z,x,y,url:BASE_URLS[mode](z,x,y)});
    return{mode,z,tiles};
   }
  }
  throw Error("Bu park için altlık PNG sınırı çok geniş.");
 }
 function loadTileImage(url){
  return new Promise((resolve,reject)=>{
   if(typeof Image!=="function"){reject(Error("Tarayıcı harita görseli oluşturamıyor."));return;}
   const img=new Image();let settled=false;
   const finish=error=>{
    if(settled)return;settled=true;clearTimeout(timeout);
    img.onload=null;img.onerror=null;
    error?reject(error):resolve(img);
   };
   const timeout=setTimeout(()=>finish(Error("Harita karosu zaman aşımı.")),7500);
   img.crossOrigin="anonymous";
   img.onload=()=>img.naturalWidth?finish():finish(Error("Boş altlık karosu."));
   img.onerror=()=>finish(Error("Altlık sağlayıcısı CORS veya ağ nedeniyle karoyu sunamadı."));
   img.src=url;
  });
 }
 async function paintBaseTiles(ctx,pr,bounds,mode){
  const plan=baseTilePlan(bounds,mode);
  if(mode==="vector")return 0;
  for(let start=0;start<plan.tiles.length;start+=4){
   const loaded=await Promise.all(plan.tiles.slice(start,start+4).map(async tile=>({tile,img:await loadTileImage(tile.url)})));
   for(const {tile,img} of loaded){
    const x0=pr.x(lonAt(tile.x,tile.z)),x1=pr.x(lonAt(tile.x+1,tile.z));
    const y0=pr.y(latAt(tile.y,tile.z)),y1=pr.y(latAt(tile.y+1,tile.z));
    ctx.drawImage(img,x0,y0,x1-x0,y1-y0);
   }
  }
  try{ctx.getImageData?.(0,0,1,1);}
  catch{throw Error("Seçili altlık PNG kullanımına izin vermiyor (CORS).");}
  return plan.tiles.length;
 }
 function eachRing(tree,visit){
  if(!Array.isArray(tree)||!tree.length)return;
  if(tree[0]&&typeof tree[0].lat==="number"&&typeof tree[0].lng==="number"){visit(tree);return;}
  for(const child of tree)eachRing(child,visit);
 }
 function drawLeaflet(ctx,pr,layer,opacity=0.6,overrideColor=null){
  const rings=[];
  if(typeof layer?.getLatLngs!=="function")return false;
  eachRing(layer.getLatLngs(),ring=>rings.push(ring));
  if(!rings.length)return false;
  ctx.beginPath();
  for(const ring of rings){
   ring.forEach((p,i)=>{const x=pr.x(p.lng),y=pr.y(p.lat);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
   ctx.closePath();
  }
  ctx.fillStyle=overrideColor||layer.options?.fillColor||layer.options?.color||"#94a3b8";
  ctx.globalAlpha=Math.min(1,Math.max(0,opacity));
  ctx.fill("evenodd");
  ctx.globalAlpha=1;
  return true;
 }

 // Presentation-only neighbour tint. Scientific type/areas remain immutable.
 const nearestPresentationCache=new WeakMap();
 const DISPLAY_CLASSES=new Set(["green","water","hard","bare","building","pool"]);
 function nearestPresentationTypes(features){
  if(!Array.isArray(features))return [];
  const cached=nearestPresentationCache.get(features);if(cached)return cached;
  const boxes=features.map(feature=>{
   const poly=feature?.geometry?.type==="MultiPolygon"?feature.geometry.coordinates:
    feature?.geometry?.type==="Polygon"?[feature.geometry.coordinates]:[];
   let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
   for(const p of poly||[])for(const ring of p||[])for(const xy of ring||[]){
    if(!Array.isArray(xy)||!Number.isFinite(xy[0])||!Number.isFinite(xy[1]))continue;
    west=Math.min(west,xy[0]);east=Math.max(east,xy[0]);
    south=Math.min(south,xy[1]);north=Math.max(north,xy[1]);
   }
   return west<=east&&south<=north?{west,east,south,north,lon:(west+east)/2,lat:(south+north)/2}:null;
  });
  const known=[];
  for(let i=0;i<features.length;i++){
   const cls=features[i]?.properties?.class;
   if(boxes[i]&&DISPLAY_CLASSES.has(cls))known.push({box:boxes[i],cls:cls==="pool"?"water":cls});
  }
  const out=features.map((f,i)=>{
   const cls=f?.properties?.class;
   if(cls!=="other"&&cls!=="nodata"&&cls!=null)return cls==="pool"?"water":cls;
   const target=boxes[i];if(!target||!known.length)return "other";
   const scale=Math.max(.05,Math.cos(target.lat*Math.PI/180));
   let winner="other",best=Infinity,tieMin=Infinity;
   for(const candidate of known){
    const box=candidate.box;
    // Projected distance to nearest envelope, not to a remote large-polygon centroid.
    const dx=Math.max(box.west-target.lon,0,target.lon-box.east)*scale;
    const dy=Math.max(box.south-target.lat,0,target.lat-box.north);
    const score=dx*dx+dy*dy;
    const cx=(target.lon-box.lon)*scale,cy=target.lat-box.lat;
    const tie=cx*cx+cy*cy;
    if(score<best||(score===best&&tie<tieMin)){
     best=score;tieMin=tie;winner=candidate.cls;
    }
   }
   return winner;
  });
  nearestPresentationCache.set(features,out);return out;
 }
 // Exact review geometry, not the transient Leaflet displayPaths (which may be
 // filtered/empty on a verified map). Pure canvas rendering: no edits to data.
 function drawVerifiedFeatures(ctx,pr,features,dict){
  let painted=0;
  const visual=nearestPresentationTypes(features);
  for(let i=0;i<(features||[]).length;i++){
   const feature=features[i],name=visual[i];
   const polys=feature?.geometry?.type==="MultiPolygon"?feature.geometry.coordinates:null;
   if(!polys?.length)continue;
   ctx.beginPath();
   let paths=0;
   for(const poly of polys)for(const ring of poly||[]){
    if(!Array.isArray(ring)||ring.length<3)continue;
    for(let i=0;i<ring.length;i++){
     const p=ring[i];if(!Array.isArray(p)||p.length<2)continue;
     if(i===0)ctx.moveTo(pr.x(p[0]),pr.y(p[1]));
     else ctx.lineTo(pr.x(p[0]),pr.y(p[1]));
    }
    ctx.closePath();paths++;
   }
   if(!paths)continue;
   // An unresolved gap is tinted like its nearest valid class for display only.
   ctx.fillStyle=name==="building"?BUILDING_COLOR:name==="water"?"#3b82f6":
    (typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS[name]:null)||dict[name]?.color||"#94a3b8";
   ctx.globalAlpha=1;
   ctx.fill("evenodd");ctx.globalAlpha=1;painted++;
  }
  return painted;
 }
 async function resolveVerifiedDisplayFeatures(sens){
  // The locked exporter reads fresh, resolved visual shapes. Reuse its exact
  // read-only public functions; a cached Leaflet view is not authoritative.
  if(typeof dgSensParts==="function"&&typeof dgSensVisualResult==="function"){
   const parts=dgSensParts(),job=await dgSensVisualResult(parts);
   if(Array.isArray(job?.displayFeatures)&&job.displayFeatures.length)return job.displayFeatures;
  }
  return Array.isArray(sens?.displayFeatures)?sens.displayFeatures:[];
 }
 function drawRawPatches(ctx,pr,patches,dict,opacity=.52){
  let painted=0;
  for(const patch of patches||[]){
   const rings=patch.rings||[];
   if(!rings.length)continue;
   ctx.beginPath();
   for(const ring of rings){
    ring.forEach((p,i)=>{const x=pr.x(p[1]),y=pr.y(p[0]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
    ctx.closePath();
   }
   ctx.globalAlpha=opacity;
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
 async function waitVegetation(sens,attempts=8){
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
  for(let i=0;i<attempts;i++){
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
  const basemap=baseChoice();
  const sens=window.DG_LC_SENS?.state,ndvi=!!sens?.vegetationView&&!sens.rawView;
  const ndviTiers=ndvi&&typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers():null;
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
  const PAD=76,TOP=110,LEGEND=ndvi?206:146;
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
  await paintBaseTiles(ctx,pr,bounds,basemap);
  let count=0;
  if(opts.cover){
   const display=Array.isArray(sens?.displayPaths)&&!sens.rawView?sens.displayPaths:[];
   if(display.length){
    const nearest=nearestPresentationTypes(sens?.displayFeatures);
    for(let i=0;i<display.length;i++){
     const item=display[i],type=item.cls==="other"?nearest[i]:item.cls;
     const color=type==="building"?BUILDING_COLOR:type==="water"||type==="pool"?"#3b82f6":
      type&&type!=="other"?(typeof DG_SENS_COLORS!=="undefined"?DG_SENS_COLORS[type]:null)||dict[type]?.color:null;
     if(drawLeaflet(ctx,pr,item.poly,Math.max(.28,(sens.opacity||65)/100),color))count++;
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
  if(ndvi&&ndviTiers?.count>=9){
   const distribution={sparse:0,moderate:0,dense:0};
   for(const tier of ndviTiers.tiers?.values?.()||[])if(tier in distribution)distribution[tier]++;
   const line="Uygun yeşil hücre: "+fmt(ndviTiers.count)+" / "+fmt(ndviTiers.eligible)+
    "  ·  Seyrek "+fmt(distribution.sparse)+"  ·  Orta "+fmt(distribution.moderate)+"  ·  Yoğun "+fmt(distribution.dense);
   ctx.font="12px system-ui,sans-serif";ctx.fillStyle="#334155";
   ctx.fillText(line,PAD,H-112,W-PAD*2);
   const cut=ndviTiers.cutoffs;
   if(Array.isArray(cut)&&cut.length===2)
    ctx.fillText("NDVI park içi üçte birlik eşikleri: "+cut.map(n=>Number(n).toFixed(3)).join(" / ")+" · Hücre başına en az 3 geçerli gözlem",PAD,H-89,W-PAD*2);
  }
  ctx.fillText(ndvi?"Göreli NDVI park içi karşılaştırmadır; mutlak taç örtüsü ölçümü değildir.":"Kaynak: ESA WorldCover 2021 v200 · OSM sınırı",PAD,H-58);
  ctx.fillText(BASE_ATTR[basemap]+" · © ESA WorldCover (CC BY 4.0) · DendroGeo",PAD,H-39);
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

 // Restore the original 1240 × 1560 verified-map layout when NDVI is enabled.
 // The ordinary verified-map dialog and its existing exporter remain untouched
 // whenever NDVI is off. Reuse ONLY read-only Leaflet display geometry and
 // the already computed relative NDVI tiers; no raster or accepted area changes.
 async function renderVerified(layers){
  const sens=window.DG_LC_SENS?.state,rec=sens?.record;
  if(!rec||typeof PARK_POLY==="undefined"||!Array.isArray(PARK_POLY)||!PARK_POLY.length){
   notify("Önce parkın arazi örtüsü analizini açın.","warn");return false;
  }
  // Doğrulanmış Harita is a scientific cartographic plate, not the PNG İndir
  // tile screenshot. Keep its original full-color map appearance.
  const showNdvi=!!sens.vegetationView&&!sens.rawView&&!!layers.surface;
  if(showNdvi&&typeof dgSensVegetationTiers!=="function"){
   notify("Göreli NDVI sınıfları bu oturumda bulunamadı.","warn");return false;
  }
  const tiers=showNdvi?dgSensVegetationTiers():null;
  if(showNdvi&&(tiers.count<9||!tiers.cutoffs)){
   notify("Doğrulanmış harita için yeterli NDVI verisi bulunamadı; en az 9 uygun yeşil hücre ve hücre başına 3 gözlem gerekir.","warn");return false;
  }
  const ndviPolys=showNdvi?await waitVegetation(sens,30):[];
  if(showNdvi&&!ndviPolys.length){
   notify("NDVI katmanı henüz çizilemedi. Eksik veriyi varmış gibi göstermemek için çıktı oluşturulmadı.","warn");return false;
  }
  // Match the original verified map's publication gate (no false verification).
  const edits=typeof dgSensEditSummary==="function"?dgSensEditSummary(rec):null;
  const nDec=Number(edits?.total||0);
  const verifiedFeatures=typeof dgSensFeatures==="function"?dgSensFeatures().length:(rec.features||[]).length;
  if(layers.surface&&!nDec&&!rec.acceptedAt&&!verifiedFeatures){
   notify("Önce yüzey kararlarını doğrulayıp kaydedin; doğrulanmamış analiz haritası yayımlanmaz.","warn");return false;
  }
  const areas=typeof dgSensAreas==="function"?dgSensAreas():rec.acceptedResult?.areas||rec.acceptedAreas||null;
  if(!areas){
   notify("Doğrulanmış alan verileri henüz hazır değil.","warn");return false;
  }
  const bounds={minLat:90,maxLat:-90,minLon:180,maxLon:-180};
  for(const ring of PARK_POLY)for(const p of ring||[]){
   if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
   bounds.minLat=Math.min(bounds.minLat,p[0]);bounds.maxLat=Math.max(bounds.maxLat,p[0]);
   bounds.minLon=Math.min(bounds.minLon,p[1]);bounds.maxLon=Math.max(bounds.maxLon,p[1]);
  }
  if(bounds.maxLat<=bounds.minLat||bounds.maxLon<=bounds.minLon){
   notify("Park sınırı geçersiz; doğrulanmış harita üretilmedi.","warn");return false;
  }
  const CW=1240,CH=1560,MX=40,MY=240,MW=760,MH=1180;
  const my=110540,mx=111320*Math.cos((bounds.minLat+bounds.maxLat)/2*Math.PI/180);
  const width=(bounds.maxLon-bounds.minLon)*mx,height=(bounds.maxLat-bounds.minLat)*my;
  const scale=Math.min((MW-40)/Math.max(width,1),(MH-40)/Math.max(height,1));
  const ox=MX+(MW-width*scale)/2,oy=MY+(MH-height*scale)/2;
  const pr={x:lon=>ox+(lon-bounds.minLon)*mx*scale,y:lat=>oy+(bounds.maxLat-lat)*my*scale};
  const canvas=document.createElement("canvas");
  canvas.width=CW;canvas.height=CH;
  const g=canvas.getContext("2d");
  if(!g){notify("Tarayıcı PNG oluşturamıyor.","err");return false;}
  const GREEN="#14532d",MUT="#5c6a63",INK="#182420",BG="#f7f6f2";
  const dict=classes();
  const color=k=>k==="building"?BUILDING_COLOR:k==="pool"?"#3b82f6":(typeof DG_SENS_COLORS!=="undefined"&&DG_SENS_COLORS[k])||
    (typeof DG_SENS_VEGETATION_COLORS!=="undefined"&&DG_SENS_VEGETATION_COLORS[k])||
    dict[k]?.color||{building:"#475569",pool:"#0ea5e9",sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"}[k]||"#94a3b8";
  g.fillStyle=BG;g.fillRect(0,0,CW,CH);
  g.fillStyle=GREEN;g.fillRect(0,0,CW,120);
  g.fillStyle="#fff";g.font="bold 44px Arial";g.fillText("DENDROGEO",40,72);
  g.font="22px Arial";g.fillStyle="#cfe3d3";g.fillText("Küresel Ağaç Envanteri ve Karbon Veri Sistemi",40,102);
  g.fillStyle="#eaf5ec";g.font="bold 30px Arial";g.textAlign="right";g.fillText("dendrogeo.org",CW-40,70);g.textAlign="left";
  g.fillStyle=GREEN;g.font="bold 32px Arial";g.fillText("DOĞRULANMIŞ PARK HARİTASI",40,172);
  const name=rec.parkName||(typeof DG_PARK!=="undefined"&&DG_PARK?.name)||"Park";
  g.fillStyle=MUT;g.font="20px Arial";
  g.fillText(name+" · "+new Date().toISOString().slice(0,10)+" · "+nDec+" karar · "+(sens.editing?"ÖNİZLEME":"KABUL EDİLMİŞ"),40,206,1150);
  g.fillStyle="#fff";g.fillRect(MX,MY,MW,MH);
  g.strokeStyle="#dfe5df";g.lineWidth=2;g.strokeRect(MX,MY,MW,MH);
  g.save();g.beginPath();
  for(const ring of PARK_POLY)outline(g,pr,ring);
  if(typeof PARK_HOLES!=="undefined")for(const ring of PARK_HOLES||[])outline(g,pr,ring);
  g.clip("evenodd");
  let painted=0;
  if(layers.surface){
   const exact=await resolveVerifiedDisplayFeatures(sens);
   painted=drawVerifiedFeatures(g,pr,exact,dict);
   if(!painted){
    notify("Kayıtlı yüzey geometrisi henüz hazır değil; boş veya eksik Doğrulanmış Harita üretilmedi.","warn");
    return false;
   }
   // NDVI is drawn after regular green class (and before grid/waypoints),
   // so only observed green cells become sparse / moderate / dense.
   if(!painted){
    notify("Arazi örtüsü çizilemedi; NDVI katmanı tek başına doğrulanmış harita sayılmaz.","warn");
    return false;
   }
   if(showNdvi)for(const poly of ndviPolys)
    if(drawLeaflet(g,pr,poly,Math.max(.45,(sens.opacity||65)/100)))painted++;
  }
  if(layers.grid&&typeof GRID_CELLS!=="undefined")for(const cell of GRID_CELLS||[]){
   if(Array.isArray(cell.geometry?.coordinates)){
    for(const polygon of cell.geometry.coordinates)for(const ring of polygon){
     g.beginPath();ring.forEach((p,i)=>{if(i)g.lineTo(pr.x(p[0]),pr.y(p[1]));else g.moveTo(pr.x(p[0]),pr.y(p[1]));});
     g.closePath();g.strokeStyle=GREEN;g.lineWidth=1;g.stroke();
    }
   }else if([cell.w0,cell.w1,cell.s0,cell.s1].every(Number.isFinite)){
    g.strokeStyle=GREEN;g.lineWidth=1;
    g.strokeRect(pr.x(cell.w0),pr.y(cell.s1),pr.x(cell.w1)-pr.x(cell.w0),pr.y(cell.s0)-pr.y(cell.s1));
   }
  }
  if(layers.waypoints){
   const pid=Number(read("gridProject")?.value);
   const points=[...(typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[]),...(typeof WP!=="undefined"?WP:[])];
   const unique=new Map(points.filter(w=>Number.isFinite(Number(w.lat))&&Number.isFinite(Number(w.lon))&&(!w.project_id||Number(w.project_id)===pid))
    .map(w=>[String(w.project_id||pid)+":"+String(w.wp_id??w.id),w]));
   for(const w of unique.values()){
    const x=pr.x(Number(w.lon)),y=pr.y(Number(w.lat));
    g.beginPath();g.arc(x,y,7,0,Math.PI*2);
    g.fillStyle=w.visited?"#22c55e":"#ef4444";g.fill();
    g.strokeStyle="#fff";g.lineWidth=2;g.stroke();
    g.fillStyle=INK;g.font="bold 14px Arial";g.fillText(String(w.wp_id??w.id??""),x+10,y+4);
   }
  }
  g.restore();
  if(layers.park){
   g.beginPath();
   for(const ring of PARK_POLY)outline(g,pr,ring);
   if(typeof PARK_HOLES!=="undefined")for(const ring of PARK_HOLES||[])outline(g,pr,ring);
   g.strokeStyle="#111827";g.lineWidth=2.5;g.stroke();
  }
  if(layers.surface&&!painted){
   notify("Doğrulanmış arazi örtüsü geometrisi çizilemedi. Yanıltıcı PNG oluşturulmadı.","warn");
   return false;
  }
  const X0=840;
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("PARK SAHASI",X0,300);
  const parkHa=typeof parkAreaHa==="function"?parkAreaHa():Object.values(areas).reduce((a,n)=>a+Number(n||0),0)/10000;
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(Number(parkHa).toFixed(1)+" ha",X0,352);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("KULLANICI DÜZENLEMESİ",X0,420,CW-X0-40);
  g.fillStyle=INK;g.font="bold 54px Arial";g.fillText(String(nDec),X0,472);
  g.fillStyle=MUT;g.font="bold 20px Arial";g.fillText("DOĞRULANMIŞ ALANLAR",X0,540);
  let y=572;
  if(layers.surface)for(const k of ["green","water","hard","bare","building"]){
   const v=Number(areas[k]||0)+(k==="water"?Number(areas.pool||0):0);
   if(v<=0)continue;
   const label=window.DG_SURFACE_REVIEW?.types?.[k]?.label||dict[k]?.label||k;
   g.fillStyle=color(k);g.fillRect(X0,y,26,26);
   g.fillStyle=INK;g.font="bold 19px Arial";g.fillText(label,X0+39,y+20,CW-X0-70);
   g.fillStyle=MUT;g.font="18px Arial";g.fillText(fmt(v/10000)+" ha",X0+39,y+44,CW-X0-70);
   y+=67;
  }
  if(showNdvi){
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
  y+=30;g.font="15px Arial";
  g.fillText("Park içi göreli sınıflama; taç örtüsü",X0,y,CW-X0-40);
  y+=22;g.fillText("ölçümü değildir. ≥3 gözlem/hücre.",X0,y,CW-X0-40);
  }
  g.fillStyle=GREEN;g.fillRect(0,CH-70,CW,70);
  g.fillStyle="#cfe3d3";g.font="19px Arial";
  g.fillText(showNdvi?"Raster + kullanıcı kararları; NDVI yeşil alanda göreli karşılaştırmadır.":"Raster + doğrulanmış kullanıcı kararları; su yüzeyleri tek sınıfta sunulur.",40,CH-54,CW-80);
  g.fillText("ESA WorldCover 2021 v200 (CC BY 4.0) · "+String(rec.fingerprint||"").slice(0,8)+" · CC BY-NC 4.0",40,CH-26,CW-80);
  return await new Promise(resolve=>canvas.toBlob(blob=>{
   if(!blob){notify("Doğrulanmış harita PNG üretilemedi.","err");resolve(false);return;}
   const uri=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=uri;
   a.download="dendrogeo_dogrulanmis_harita_"+safeName(name)+(showNdvi?"_goreli_ndvi":"")+".png";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(uri),2000);
   notify("Doğrulanmış Harita PNG indirildi"+(showNdvi?" · Yeşil alan göreli NDVI dahil":""),"ok");
   resolve(true);
  },"image/png"));
 }
 async function exportVerified(layers){
  try{return await renderVerified(layers);}
  catch(error){console.error("DendroGeo doğrulanmış harita NDVI:",error);notify("NDVI doğrulanmış haritası üretilemedi: "+(error?.message||String(error)),"err");return false;}
 }

 async function exportMap(){
  try{return await render();}
  catch(error){console.error("DendroGeo PNG dışa aktarım:",error);notify("PNG oluşturulamadı: "+(error?.message||String(error)),"err");return false;}
 }
 // Capture the legacy inline PNG button before its locked handler runs.
 // The older handler assumes a lazily loaded class array and may throw on .find().
 // Do not modify that locked module or the scientific analysis state.
 if(typeof document.addEventListener==="function")document.addEventListener("click",event=>{
  const exportAction=event.target?.closest?.("#dgExportDownload");
  const sens=window.DG_LC_SENS?.state;
  // Preserve original verified-map layer selector; both NDVI and standard
  // maps now present legacy pool inside Su, without editing the locked core.
  if(exportAction){
   const dialog=exportAction.closest?.("dialog");
   if(dialog?.id==="dgSurfaceExportDialog"&&dialog.querySelector('[name="surface"]')?.checked){
    const layers=Object.fromEntries(["park","surface","grid","waypoints"].map(key=>[key,!!dialog.querySelector('[name="'+key+'"]')?.checked]));
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
    exportVerified(layers);
    return;
   }
  }
  // Plain PNG is still exported by the safe adapter. The verified map
  // button itself is never captured: it opens the original layer dialog.
  const button=event.target?.closest?.('button[onclick*="downloadParkImage"]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  exportMap();
 },true);
 window.DG_GIS_PNG_EXPORT={download:exportMap,downloadVerified:exportVerified,classes,eachRing,baseTilePlan,nearestPresentationTypes};
 window.downloadParkImage=exportMap;
})();