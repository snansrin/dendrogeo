/* Presentation rules for GIS PNG export; no analysis state writes. */
(function(root){
 "use strict";
 const PALETTE={
  green:{color:"#4ade80",label:"Yeşil alan"},
  water:{color:"#3b82f6",label:"Su"},
  hard:{color:"#64748b",label:"Sert zemin"},
  bare:{color:"#8b5a2b",label:"Çıplak zemin"},
  other:{color:"#94a3b8",label:"Diğer"}
 };
 function classes(getClasses){
  const current=getClasses();
  // DG_LC_CLASSES is loaded lazily, so never capture it at startup.
  if(Array.isArray(current))
   return Object.fromEntries(current.map(x=>[x.key,{color:x.color,label:x.label}]));
  return PALETTE;
 }
 function fmt(n){return Number(n).toLocaleString("tr-TR",{maximumFractionDigits:2});}
 function safeName(s){return String(s||"park").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,48).toLowerCase();}
 function color(key,{surfaceColors,vegetationColors,classes}){
  return surfaceColors?.[key]||vegetationColors?.[key]||classes[key]?.color||
   {building:"#475569",pool:"#3b82f6",sparse:"#fde68a",moderate:"#4ade80",dense:"#166534"}[key]||"#94a3b8";
 }
 root.DG_GIS_EXPORT_PRESENTATION=Object.freeze({classes,format:fmt,safeName,color});
})(window);
