"use strict";
/* Shared Blob download and object-URL cleanup for GIS PNG exports. */
(function(root){
 function save({canvas,filename,onUnavailable,onDownloaded}){
  return new Promise(resolve=>canvas.toBlob(blob=>{
   if(!blob){if(typeof onUnavailable==="function")onUnavailable();resolve(false);return;}
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");
   link.href=url;
   link.download=filename;
   document.body.append(link);
   link.click();
   link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   if(typeof onDownloaded==="function")onDownloaded(blob);
   resolve(true);
  },"image/png"));
 }
 root.DG_GIS_EXPORT_DOWNLOAD=Object.freeze({save});
})(window);
