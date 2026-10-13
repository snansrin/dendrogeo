"use strict";
(function(root){
 function render(title,content,isCSV,filename,ports){
  ports.title().textContent=title;
  if(isCSV){
   const lines=content.replace(/^\uFEFF/,"").split("\n").filter(Boolean).slice(0,100);
   let html="<table><thead><tr>"+lines[0].split(",").map(header=>`<th scope='col'>${header}</th>`).join("")+"</tr></thead><tbody>";
   for(let index=1;index<lines.length;index++)html+="<tr>"+lines[index].split(",").map(cell=>`<td>${ports.escape(cell)}</td>`).join("")+"</tr>";
   ports.body().innerHTML=html+"</tbody></table>";
  }else ports.body().innerHTML=`<pre style="font-size:.75rem;white-space:pre-wrap">${ports.escape(content.slice(0,20000))}</pre>`;
  ports.downloadButton().onclick=()=>ports.download(content,filename);
  ports.modal().classList.add("on");
 }
 root.DG_EXPORT_PREVIEW_UI=Object.freeze({render});
})(window);
