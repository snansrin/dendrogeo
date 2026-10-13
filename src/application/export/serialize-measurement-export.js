"use strict";
(function(root){
 function serialize(format,rows,ports){
  if(format==="csv"||format==="qgis")return ports.csv(rows);
  if(format==="geojson")return JSON.stringify(ports.geojson(rows,!!ports.preview),null,2);
  throw new Error("Bilinmeyen dışa aktarım biçimi: "+format);
 }
 root.DG_SERIALIZE_MEASUREMENT_EXPORT=Object.freeze({serialize});
})(window);
