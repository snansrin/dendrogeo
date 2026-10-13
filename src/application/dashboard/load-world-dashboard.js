"use strict";
(function(root){
 async function execute(ports){
  ports.hideError();
  try{
   const{global,countries,cities}=await ports.loadStats();
   if(global.data)ports.updateStats(global.data);
   ports.renderCountries(countries.data||[]);ports.renderCities(cities.data||[]);
   ports.loadMarkers((count,rows,error)=>{
    if(error)return ports.showError("İşaretçiler yüklenemedi: "+error);
    ports.markLiveDirty();
    if(ports.clusterDegraded())ports.warn("DENDROGEO · dünya haritası kümelenmeden çizildi (markercluster yok)");
    ports.renderAnalysis(rows,"worldAnalysis");
   });
   ports.loadParkCompare();
  }catch(error){ports.showError((error&&(error.message||error))+"");}
 }
 root.DG_LOAD_WORLD_DASHBOARD=Object.freeze({execute});
})(window);
