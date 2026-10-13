"use strict";
(function(root){
 function download(content,name,ports){
  const anchor=ports.document.createElement("a");
  anchor.href=ports.URL.createObjectURL(new ports.Blob([content],{type:"text/csv;charset=utf-8;"}));
  anchor.download=name;
  anchor.click();
  return anchor;
 }
 root.DG_EXPORT_FILE_DOWNLOAD=Object.freeze({download});
})(window);
