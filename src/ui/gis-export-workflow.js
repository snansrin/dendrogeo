/* Standard GIS PNG workflow with injected presentation and browser adapters. */
(function(root){
 "use strict";
 function create({platform,sources,classes,outline,waitVegetation,presentation,getLayoutApi,getGeometryApi,getCanvasApi,draw,save,getParkRings,getSensitivity,getTiersFunction,getHoles,getParkName,getVegetationColors}){
  const {notify}=platform;const {format:fmt,safeName}=presentation;
 async function render(){
  if(!Array.isArray(getParkRings())||!getParkRings().length){
   notify("Önce bir park seçin.","warn");return false;
  }
  const opts=platform.options();
  const sens=getSensitivity(),ndvi=!!sens?.vegetationView&&!sens.rawView;
  const ndviTiers=ndvi&&typeof getTiersFunction()==="function"?getTiersFunction()():null;
  const ndviPolys=ndvi?await waitVegetation(sens):[];
  if(ndvi&&!ndviPolys.length){
   notify("Göreli NDVI açık, ancak gösterilecek en az 3 gözlemli NDVI katmanı hazır değil. Yanlış PNG oluşturmamak için indirme durduruldu.","warn");
   return false;
  }
  const layout=getLayoutApi().compute({rings:getParkRings(),ndvi,project:getGeometryApi().project});
  if(!layout){notify("Park geometrisi geçersiz, PNG oluşturulmadı.","err");return false;}
  const {W,H}=layout;
  const {canvas:cv,context:ctx}=platform.canvas(W,H);if(!ctx){notify("Bu tarayıcı PNG oluşturmayı desteklemiyor.","err");return false;}
  const {count}=draw({
   context:ctx,layout,options:opts,sensitivity:sens,ndvi,ndviTiers,ndviPolys,parkRings:getParkRings(),
   holes:getHoles(),
   parkName:getParkName(),classMap:classes(),canvasApi:getCanvasApi(),
   ...sources.standard(),
   vegetationColors:getVegetationColors(),
   format:fmt,outline
  });
  if(!count&&!ndvi){notify("Bu park için çizilecek yüzey geometrisi henüz hazırlanmadı. Önce analizi açın.","warn");return false;}
  const filename="dendrogeo_"+safeName(getParkName())+
   (ndvi?"_goreli_ndvi":"_dogrulanmis_harita")+"_"+new Date().toISOString().slice(0,10)+".png";
  return await save({canvas:cv,filename,
   onUnavailable:()=>notify("PNG üretilemedi.","err"),
   onDownloaded:()=>notify("PNG indirildi"+(ndvi?" · Göreli NDVI katmanı dahil":""),"ok")
  });
 }
  return Object.freeze({render});
 }
 root.DG_GIS_EXPORT_WORKFLOW=Object.freeze({create});
})(window);
