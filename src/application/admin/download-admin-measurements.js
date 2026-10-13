"use strict";
(function(root){
 async function execute(format,ports){
  const rows=await ports.read();
  if(!rows.length)return ports.onEmpty(format);
  if(format==="geojson")ports.download(JSON.stringify(ports.geojson(rows),null,2),"dendrogeo_toplu.geojson");
  else ports.download(ports.csv(rows),format==="qgis"?"dendrogeo_qgis_detayli.csv":"dendrogeo_toplu.csv");
  ports.onSuccess(format,rows.length);
 }
 root.DG_DOWNLOAD_ADMIN_MEASUREMENTS=Object.freeze({execute});
})(window);
