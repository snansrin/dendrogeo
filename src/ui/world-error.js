"use strict";
(function(root){
 const bindings=new WeakSet(),actionsByBox=new WeakMap();
 function bind(box,actions){if(!box||typeof box.addEventListener!=="function")return;actionsByBox.set(box,actions||{});if(bindings.has(box))return;bindings.add(box);box.addEventListener("click",event=>{const button=event.target?.closest?.('[data-world-error-action="retry"]');if(button&&box.contains(button))actionsByBox.get(box)?.retry?.();});}
 function render(message,escape){
  return `<b>⚠ Dünya verisi yüklenemedi</b> — sayılar/harita bu yüzden boş olabilir. Kayıt silinmedi: <span class="mono" style="font-size:.74rem">${escape(message)}</span> <button class="btn sm" style="margin-left:6px" data-world-error-action="retry">↻ Yeniden dene</button>`;
 }
 function hide(document){const box=document.getElementById("worldErr");if(box)box.style.display="none";}
 function show(document,message,escape,actions){
  const box=document.getElementById("worldErr");if(!box)return false;
  bind(box,actions);box.style.display="";box.className="alert err";box.innerHTML=render(message,escape);return true;
 }
 root.DG_WORLD_ERROR_UI=Object.freeze({render,hide,show,bind});
})(window);
