"use strict";

/* Render the existing own-request disclosure from already-loaded rows. */
(function(root){
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){if(!element||typeof element.addEventListener!=="function")return;actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);element.addEventListener("click",event=>{const button=event.target?.closest?.('[data-request-list-action="delete"]');if(!button||!element.contains(button))return;const id=Number(button.dataset.requestId);if(Number.isSafeInteger(id)&&id>0)actionsByElement.get(element)?.delete?.(id);});}
 function failure(element){element.innerHTML='<div class="alert err">Talepler yüklenemedi.</div>';}
 function clear(element){element.innerHTML="";}
 function render(element,data,{escape=value=>String(value),actions}={}){
 bind(element,actions);
 const rows=data.map(r=>{
  const filt=[escape(r.country),escape(r.city),escape(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const bc=r.status==="Tamamlandı"?"on":(r.status==="İşleme Alındı"?"admin":"off");
  const dt=r.created_at?new Date(r.created_at).toLocaleDateString("tr-TR"):"";
  return `<div class="export-request-item"><div class="export-request-item-main"><b>${filt}</b><small>${dt}${r.note?" · "+escape(r.note):""}</small></div><span class="badge ${bc}">${escape(r.status||"Beklemede")}</span><button class="btn sm red export-request-delete" type="button" data-request-list-action="delete" data-request-id="${Number(r.id)}" aria-label="${escape(filt)} talebini sil">🗑 Sil</button></div>`;
 }).join("");
 element.innerHTML=`<details class="export-my-requests"><summary><span>📨 Taleplerim</span><span class="badge">${data.length}</span></summary><div class="export-request-list">${rows}</div></details>`;
 }
 root.DG_MY_DATA_REQUESTS_UI=Object.freeze({render,failure,clear,bind});
})(window);
