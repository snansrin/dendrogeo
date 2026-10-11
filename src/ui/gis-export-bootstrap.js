/* Bootstrap and legacy API bridge for GIS PNG export. */
(function(root){
 "use strict";
 function install({document,window,events,render,renderVerified,notify,classes,eachRing,console}){
 async function exportVerified(layers){
  try{return await renderVerified(layers);}
  catch(error){console.error("DendroGeo doğrulanmış harita NDVI:",error);notify("NDVI doğrulanmış haritası üretilemedi: "+(error?.message||String(error)),"err");return false;}
 }

 async function exportMap(){
  try{return await render();}
  catch(error){console.error("DendroGeo PNG dışa aktarım:",error);notify("PNG oluşturulamadı: "+(error?.message||String(error)),"err");return false;}
 }
 events.bind({document,window,exportMap,exportVerified});
 window.DG_GIS_PNG_EXPORT={download:exportMap,downloadVerified:exportVerified,classes,eachRing};
 window.downloadParkImage=exportMap;
  return window.DG_GIS_PNG_EXPORT;
 }
 root.DG_GIS_EXPORT_BOOTSTRAP=Object.freeze({install});
})(window);
