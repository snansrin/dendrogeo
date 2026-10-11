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
 function outline(ctx,pr,ring){
  if(!Array.isArray(ring)||!ring.length)return;
  window.DG_PARK_IMAGE_GEOMETRY.appendRing({context:ctx,projector:{X:pr.X||pr.x,Y:pr.Y||pr.y},ring});
 }
 function waitVegetation(sens,attempts=8){
  return window.DG_GIS_EXPORT_VEGETATION.waitForLayers(sens,{attempts,
   tiers:typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null,
   render:typeof dgSensRenderVegetation==="function"?dgSensRenderVegetation:null
  });
 }
 function fmt(n){return Number(n).toLocaleString("tr-TR",{maximumFractionDigits:2});}
 function safeName(s){return String(s||"park").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,48).toLowerCase();}
 const eachRing=(tree,visit)=>window.DG_GIS_EXPORT_CANVAS.eachRing(tree,visit);
 async function render(){
  if(typeof PARK_POLY==="undefined"||!Array.isArray(PARK_POLY)||!PARK_POLY.length){
   notify("Önce bir park seçin.","warn");return false;
  }
  const opts={cover:read("chkPngCover")?.checked!==false,grid:read("chkPngGrid")?.checked!==false,wp:read("chkPngWp")?.checked!==false};
  const sens=window.DG_LC_SENS?.state,ndvi=!!sens?.vegetationView&&!sens.rawView;
  const ndviTiers=ndvi&&typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers():null;
  const ndviPolys=ndvi?await waitVegetation(sens):[];
  if(ndvi&&!ndviPolys.length){
   notify("Göreli NDVI açık, ancak gösterilecek en az 3 gözlemli NDVI katmanı hazır değil. Yanlış PNG oluşturmamak için indirme durduruldu.","warn");
   return false;
  }
  const layout=window.DG_GIS_EXPORT_LAYOUT.compute({rings:PARK_POLY,ndvi,project:window.DG_PARK_IMAGE_GEOMETRY.project});
  if(!layout){notify("Park geometrisi geçersiz, PNG oluşturulmadı.","err");return false;}
  const {W,H,PAD,TOP,LEGEND,projection:pr}=layout;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");if(!ctx){notify("Bu tarayıcı PNG oluşturmayı desteklemiyor.","err");return false;}
  const {count}=window.DG_GIS_EXPORT_STANDARD_CANVAS.draw({
   context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviTiers,ndviPolys,parkRings:PARK_POLY,
   holes:typeof PARK_HOLES!=="undefined"?PARK_HOLES||[]:[],
   parkName:typeof DG_PARK!=="undefined"?DG_PARK?.name:null,classMap:classes(),canvasApi:window.DG_GIS_EXPORT_CANVAS,
   getLandcover:()=>window.DG_LANDCOVER?.getLast?.(),
   getGridCells:typeof DG_GRID_SESSION!=="undefined"?()=>DG_GRID_SESSION.getCells():null,
   getWaypoints:typeof WP!=="undefined"?()=>WP:null,
   vegetationColors:typeof DG_SENS_VEGETATION_COLORS!=="undefined"?DG_SENS_VEGETATION_COLORS:{sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"},
   format:fmt,outline
  });
  if(!count&&!ndvi){notify("Bu park için çizilecek yüzey geometrisi henüz hazırlanmadı. Önce analizi açın.","warn");return false;}
  const filename="dendrogeo_"+safeName(typeof DG_PARK!=="undefined"?DG_PARK?.name:"park")+
   (ndvi?"_goreli_ndvi":"_dogrulanmis_harita")+"_"+new Date().toISOString().slice(0,10)+".png";
  return await window.DG_GIS_EXPORT_DOWNLOAD.save({canvas:cv,filename,
   onUnavailable:()=>notify("PNG üretilemedi.","err"),
   onDownloaded:()=>notify("PNG indirildi"+(ndvi?" · Göreli NDVI katmanı dahil":""),"ok")
  });
 }

 // Restore the original 1240 × 1560 verified-map layout when NDVI is enabled.
 // The ordinary verified-map dialog and its existing exporter remain untouched
 // whenever NDVI is off. Reuse ONLY read-only Leaflet display geometry and
 // the already computed relative NDVI tiers; no raster or accepted area changes.
 async function renderVerified(layers){
  const sens=window.DG_LC_SENS?.state,rec=sens?.record;
  const name=rec?.parkName||(typeof DG_PARK!=="undefined"&&DG_PARK?.name)||"Park";
  const gate=window.DG_PREPARE_VERIFIED_MAP_EXPORT.prepare({
   record:rec,hasPark:typeof PARK_POLY!=="undefined"&&Array.isArray(PARK_POLY)&&PARK_POLY.length>0,
   vegetationView:sens?.vegetationView,rawView:sens?.rawView,
   getTiers:typeof dgSensVegetationTiers==="function"?dgSensVegetationTiers:null
  });
  if(!gate.ok){notify(gate.message,gate.type);return false;}
  const tiers=gate.tiers;
  const ndviPolys=await waitVegetation(sens,30);
  if(!ndviPolys.length){
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
  const layout=window.DG_GIS_EXPORT_LAYOUT.computeVerified({rings:PARK_POLY});
  if(!layout){
   notify("Park sınırı geçersiz; doğrulanmış harita üretilmedi.","warn");return false;
  }
  const {CW,CH,MX,MY,MW,MH,projector:pr}=layout;
  const canvas=document.createElement("canvas");
  canvas.width=CW;canvas.height=CH;
  const g=canvas.getContext("2d");
  if(!g){notify("Tarayıcı PNG oluşturamıyor.","err");return false;}
  const classMap=classes();
  const draw=window.DG_GIS_EXPORT_VERIFIED_CANVAS.draw({
   context:g,layout,layers,sensitivity:sens,record:rec,tiers,ndviPolys,parkRings:PARK_POLY,
   holes:typeof PARK_HOLES!=="undefined"?PARK_HOLES||[]:[],decisionCount:nDec,areas,parkName:name,classes:classMap,
   canvasApi:window.DG_GIS_EXPORT_CANVAS,
   getLandcover:()=>window.DG_LANDCOVER?.getLast?.(),
   readProjectId:()=>Number(read("gridProject")?.value),
   getGridCells:()=>typeof DG_GRID_SESSION!=="undefined"?DG_GRID_SESSION.getCells()||[]:null,
   getWaypoints:()=>typeof WP!=="undefined"?WP:[],
   getLastWaypoints:()=>typeof LAST_WP_ROWS!=="undefined"?LAST_WP_ROWS:[],
   hasParkAreaHa:()=>typeof parkAreaHa==="function",
   getParkAreaHa:()=>parkAreaHa(),
   getSurfaceTypes:()=>window.DG_SURFACE_REVIEW?.types,
   formatArea:fmt,outline,
   color:key=>(typeof DG_SENS_COLORS!=="undefined"&&DG_SENS_COLORS[key])||
    (typeof DG_SENS_VEGETATION_COLORS!=="undefined"&&DG_SENS_VEGETATION_COLORS[key])||
    classMap[key]?.color||{building:"#475569",pool:"#0ea5e9",sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"}[key]||"#94a3b8"
  });
  if(!draw.ok){notify(draw.message,"warn");return false;}
  return await window.DG_GIS_EXPORT_DOWNLOAD.save({canvas,filename:"dendrogeo_dogrulanmis_harita_"+safeName(name)+"_goreli_ndvi.png",
   onUnavailable:()=>notify("Doğrulanmış harita PNG üretilemedi.","err"),
   onDownloaded:()=>notify("Doğrulanmış Harita PNG indirildi · Yeşil alan göreli NDVI dahil","ok")
  });
 }
 async function exportVerified(layers){
  try{return await renderVerified(layers);}
  catch(error){console.error("DendroGeo doğrulanmış harita NDVI:",error);notify("NDVI doğrulanmış haritası üretilemedi: "+(error?.message||String(error)),"err");return false;}
 }

 async function exportMap(){
  try{return await render();}
  catch(error){console.error("DendroGeo PNG dışa aktarım:",error);notify("PNG oluşturulamadı: "+(error?.message||String(error)),"err");return false;}
 }
 window.DG_GIS_EXPORT_EVENTS.bind({document,window,exportMap,exportVerified});
 window.DG_GIS_PNG_EXPORT={download:exportMap,downloadVerified:exportVerified,classes,eachRing};
 window.downloadParkImage=exportMap;
})();
