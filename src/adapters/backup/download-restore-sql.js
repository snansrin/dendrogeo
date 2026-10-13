"use strict";
(function(root){
 function download(browser,sql,filename){
  const anchor=browser.document.createElement("a");
  anchor.href=browser.URL.createObjectURL(new browser.Blob([sql],{type:"application/sql"}));
  anchor.download=filename;
  browser.document.body.appendChild(anchor);anchor.click();anchor.remove();
  browser.setTimeout(()=>browser.URL.revokeObjectURL(anchor.href),5000);
 }
 root.DG_BACKUP_RESTORE_SQL_DOWNLOAD=Object.freeze({download});
})(window);
