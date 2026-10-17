/* Read-only bridge for the legacy park PNG exporter when land-cover classes
 * are initialized lazily. It does not invoke analysis or change class data. */
(function(root){
 "use strict";
 function install(){
  let captured;
  try{captured=typeof DG_LC_CLASSES_SAF!=="undefined"?DG_LC_CLASSES_SAF:null;}
  catch(error){return false;}
  if(Array.isArray(captured))return true;
  if(typeof captured!=="function")return false;
  if(typeof captured.find==="function")return true;
  try{
   Object.defineProperty(captured,"find",{
    configurable:true,
    value(predicate){
     let current;
     try{current=typeof DG_LC_CLASSES!=="undefined"?DG_LC_CLASSES:null;}
     catch(error){return undefined;}
     return Array.isArray(current)?Array.prototype.find.call(current,predicate):undefined;
    }
   });
   return true;
  }catch(error){return false;}
 }
 root.DG_PARK_EXPORT_LAZY_CLASSES=Object.freeze({install});
 install();
})(window);
