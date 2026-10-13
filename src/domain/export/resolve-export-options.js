"use strict";
(function(root){
 const options={
  csv:{activity:"CSV",fileName:"dendrogeo.csv",previewTitle:"CSV Önizleme (ilk 100 satır)",isCSV:true},
  qgis:{activity:"QGIS",fileName:"dendrogeo_qgis.csv",isCSV:true},
  geojson:{activity:"GeoJSON",fileName:"dendrogeo.geojson",previewTitle:"GeoJSON Önizleme",isCSV:false}
 };
 function resolve(format){
  const option=options[String(format||"").toLowerCase()];
  return option?{...option}:null;
 }
 root.DG_RESOLVE_EXPORT_OPTIONS=Object.freeze({resolve});
})(window);
