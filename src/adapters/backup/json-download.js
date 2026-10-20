"use strict";
window.DG_BACKUP_JSON_DOWNLOAD={
 download(browser,backup,name){
  const a=browser.document.createElement("a");
  a.href=browser.URL.createObjectURL(new browser.Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
  a.download=name;
  browser.document.body.appendChild(a);a.click();a.remove();
  browser.setTimeout(()=>browser.URL.revokeObjectURL(a.href),5000);
 }
};
