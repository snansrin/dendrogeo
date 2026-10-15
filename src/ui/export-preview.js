"use strict";
(function(root){
 function render(title,content,isCSV,filename,{document,escape,download}){
  const titleElement=document.getElementById("pvTitle"),body=document.getElementById("pvBody"),downloadButton=document.getElementById("pvDownload"),modal=document.getElementById("previewModal");
  if(!titleElement||!body||!downloadButton||!modal)return false;
  titleElement.textContent=title;
  if(isCSV){
   const lines=content.replace(/^\uFEFF/,"").split("\n").filter(Boolean).slice(0,100);
   let html="<table><thead><tr>"+lines[0].split(",").map(header=>`<th scope='col'>${header}</th>`).join("")+"</tr></thead><tbody>";
   for(let index=1;index<lines.length;index++)html+="<tr>"+lines[index].split(",").map(cell=>`<td>${escape(cell)}</td>`).join("")+"</tr>";
   body.innerHTML=html+"</tbody></table>";
  }else body.innerHTML=`<pre style="font-size:.75rem;white-space:pre-wrap">${escape(content.slice(0,20000))}</pre>`;
  downloadButton.onclick=()=>download(content,filename);
  modal.classList.add("on");
  return true;
 }
 function close(document){document.getElementById("previewModal")?.classList.remove("on");}
 root.DG_EXPORT_PREVIEW_UI=Object.freeze({render,close});
})(window);
