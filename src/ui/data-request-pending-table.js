"use strict";

/* Render active requests and their visible queue counters. */
(function(root){
 function updateCounts(document,pending){
  for(const id of ["aReqPending","aReqPendingMini"]){const element=document.getElementById(id);if(element)element.textContent=pending.length;}
 }
 function render(element,pending,{escape=value=>String(value)}={}){
 element.innerHTML=pending.length?pending.map(r=>{
  const filt=[escape(r.country),escape(r.city),escape(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const hasNote=r.note&&r.note.trim().length>0;
  return `<tr>
   <td data-label="Kullanıcı">${escape(r.profiles?.full_name)||"—"}</td>
   <td data-label="E‑posta">${escape(r.email)||"—"}</td>
   <td data-label="Filtre"><b>${escape(filt)}</b></td>
   <td data-label="Tarih">${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
   <td data-label="Durum"><span class="badge admin">${r.status}</span></td>
   <td data-label="İşlem" style="display:flex;gap:4px;flex-wrap:wrap">
    <button class="btn sm blue" onclick="fulfillRequest(${r.id})">📥✉️ İndir ve Yanıtla</button>
    <button class="btn sm red" onclick="rejectRequest(${r.id})">🚫 Reddet</button>
   </td>
  </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${escape(r.note)}</td></tr>`:""}`;
 }).join(""):"<tr><td colspan=6 style='text-align:center;color:var(--mut)'>Bekleyen talep yok</td></tr>";
 
 }
 root.DG_DATA_REQUEST_PENDING_TABLE_UI=Object.freeze({render,updateCounts});
})(window);
