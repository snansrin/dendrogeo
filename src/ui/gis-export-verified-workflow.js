/* Verified NDVI PNG workflow; preserves publication gates and read-only inputs. */
(function(root){
 "use strict";
 function create({platform,sources,presentation,classes,outline,waitVegetation,prepare,computeLayout,drawCanvas,save,getSensitivity,getParkName,getParkRings,getTiersFunction,getEditSummary,getFeatureCount,getAreas,getHoles,getCanvasApi,getSurfaceColors,getVegetationColors}){
  const {notify}=platform;const {format:fmt,safeName}=presentation;
 async function renderVerified(layers){
  const sens=getSensitivity(),rec=sens?.record;
  const name=rec?.parkName||getParkName()||"Park";
  const gate=prepare({
   record:rec,hasPark:Array.isArray(getParkRings())&&getParkRings().length>0,
   vegetationView:sens?.vegetationView,rawView:sens?.rawView,
   getTiers:getTiersFunction()
  });
  if(!gate.ok){notify(gate.message,gate.type);return false;}
  const tiers=gate.tiers;
  const ndviPolys=await waitVegetation(sens,30);
  if(!ndviPolys.length){
   notify("NDVI katmanı henüz çizilemedi. Eksik veriyi varmış gibi göstermemek için çıktı oluşturulmadı.","warn");return false;
  }
  // Match the original verified map's publication gate (no false verification).
  const edits=getEditSummary(rec);
  const nDec=Number(edits?.total||0);
  const verifiedFeatures=getFeatureCount(rec);
  if(layers.surface&&!nDec&&!rec.acceptedAt&&!verifiedFeatures){
   notify("Önce yüzey kararlarını doğrulayıp kaydedin; doğrulanmamış analiz haritası yayımlanmaz.","warn");return false;
  }
  const areas=getAreas(rec);
  if(!areas){
   notify("Doğrulanmış alan verileri henüz hazır değil.","warn");return false;
  }
  const layout=computeLayout({rings:getParkRings()});
  if(!layout){
   notify("Park sınırı geçersiz; doğrulanmış harita üretilmedi.","warn");return false;
  }
  const {CW,CH}=layout;
  const {canvas,context:g}=platform.canvas(CW,CH);
  if(!g){notify("Tarayıcı PNG oluşturamıyor.","err");return false;}
  const classMap=classes();
  const draw=drawCanvas({
   context:g,layout,layers,sensitivity:sens,record:rec,tiers,ndviPolys,parkRings:getParkRings(),
   holes:getHoles(),decisionCount:nDec,areas,parkName:name,classes:classMap,
   canvasApi:getCanvasApi(),
   ...sources.verified(),
   formatArea:fmt,outline,
   color:key=>presentation.color(key,{
    surfaceColors:getSurfaceColors(),
    vegetationColors:getVegetationColors(),classes:classMap
   })
  });
  if(!draw.ok){notify(draw.message,"warn");return false;}
  return await save({canvas,filename:"dendrogeo_dogrulanmis_harita_"+safeName(name)+"_goreli_ndvi.png",
   onUnavailable:()=>notify("Doğrulanmış harita PNG üretilemedi.","err"),
   onDownloaded:()=>notify("Doğrulanmış Harita PNG indirildi · Yeşil alan göreli NDVI dahil","ok")
  });
 }
  return Object.freeze({renderVerified});
 }
 root.DG_GIS_EXPORT_VERIFIED_WORKFLOW=Object.freeze({create});
})(window);
