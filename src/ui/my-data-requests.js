"use strict";

/* Render the existing own-request disclosure from already-loaded rows. */
(function(root){
 function failure(element){element.innerHTML='<div class="alert err">Talepler yüklenemedi.</div>';}
 function clear(element){element.innerHTML="";}
 function render(element,data,{escape=value=>String(value)}={}){
 const rows=data.map(r=>{
  const filt=[escape(r.country),escape(r.city),escape(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const bc=r.status==="Tamamlandı"?"on":(r.status==="İşleme Alındı"?"admin":"off");
  const dt=r.created_at?new Date(r.created_at).toLocaleDateString("tr-TR"):"";
  return `<div class="export-request-item"><div class="export-request-item-main"><b>${filt}</b><small>${dt}${r.note?" · "+escape(r.note):""}</small></div><span class="badge ${bc}">${escape(r.status||"Beklemede")}</span><button class="btn sm red export-request-delete" type="button" onclick="deleteMyRequest(${Number(r.id)})" aria-label="${escape(filt)} talebini sil">🗑 Sil</button></div>`;
 }).join("");
 element.innerHTML=`<details class="export-my-requests"><summary><span>📨 Taleplerim</span><span class="badge">${data.length}</span></summary><div class="export-request-list">${rows}</div></details>`;
 }
 root.DG_MY_DATA_REQUESTS_UI=Object.freeze({render,failure,clear});
})(window);
