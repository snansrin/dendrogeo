"use strict";
(function(root){
 function show({title,body,csv,fileName,elements,download}){
  elements.title.textContent=title;
  elements.body.innerHTML=body;
  elements.download.onclick=()=>download(csv,fileName);
  elements.modal.classList.add("on");
 }
 root.DG_PARK_REPORT_PREVIEW_UI=Object.freeze({show});
})(window);
