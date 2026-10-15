"use strict";

/* Render closed request rows and own their section visibility and count. */
(function(root){
 function renderSection(document,closed,{escape=value=>String(value)}={}){
  const count=document.getElementById("aReqClosed"),wrap=document.getElementById("closedRequestsWrap"),table=document.getElementById("closedReqT");
  if(count)count.textContent=closed.length;
  if(wrap)wrap.style.display=closed.length>0?"block":"none";
  if(closed.length&&table)render(table,closed,{escape});
 }
 function render(element,closed,{escape=value=>String(value)}={}){
  element.innerHTML=closed.map(r=>{
   const filt=[escape(r.country),escape(r.city),escape(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
   const bc=r.status==="Tamamlandı"?"on":"off";
   const hasNote=r.note&&r.note.trim().length>0;
   const closedDate=r.fulfilled_at?new Date(r.fulfilled_at).toLocaleDateString("tr-TR"):"";
   return `<tr>
    <td data-label="Kullanıcı">${escape(r.profiles?.full_name)||"—"}</td>
    <td data-label="E‑posta">${escape(r.email)||"—"}</td>
    <td data-label="Filtre">${escape(filt)}</td>
    <td data-label="Talep">${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
    <td data-label="Kapanış">${closedDate}</td>
    <td data-label="Durum"><span class="badge ${bc}">${r.status}</span></td>
   </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${escape(r.note)}</td></tr>`:""}`;
  }).join("");
 }
 root.DG_DATA_REQUEST_CLOSED_TABLE_UI=Object.freeze({render,renderSection});
})(window);
