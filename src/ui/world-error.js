"use strict";
(function(root){
 function render(message,escape){
  return `<b>⚠ Dünya verisi yüklenemedi</b> — sayılar/harita bu yüzden boş olabilir. Kayıt silinmedi: <span class="mono" style="font-size:.74rem">${escape(message)}</span> <button class="btn sm" style="margin-left:6px" onclick="loadWorld()">↻ Yeniden dene</button>`;
 }
 function hide(document){const box=document.getElementById("worldErr");if(box)box.style.display="none";}
 function show(document,message,escape){
  const box=document.getElementById("worldErr");if(!box)return false;
  box.style.display="";box.className="alert err";box.innerHTML=render(message,escape);return true;
 }
 root.DG_WORLD_ERROR_UI=Object.freeze({render,hide,show});
})(window);
