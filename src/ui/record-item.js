"use strict";
(function(root){
 const bindings=new WeakSet(),actionsByElement=new WeakMap();
 function bind(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
  element.addEventListener("click",event=>{
   const button=event.target?.closest?.("[data-record-action]");
   if(!button||!element.contains(button))return;
   const handlers=actionsByElement.get(element)||{},id=Number(button.dataset.recordId);
   if(!Number.isSafeInteger(id)||id<1)return;
   if(button.dataset.recordAction==="edit")handlers.edit?.(id);
   else if(button.dataset.recordAction==="delete")handlers.delete?.(id);
  });
 }
 function render(row,{escape,thumbnail,statusMeta}){
  const status=statusMeta(row.status);
  const dbh=Number.isFinite(+row.dbh_cm)?(+row.dbh_cm).toFixed(1):"—";
  const girth=Number.isFinite(+row.girth_cm)&&+row.girth_cm>0?(+row.girth_cm).toFixed(1):"—";
  const height=Number.isFinite(+row.height_m)?(+row.height_m).toFixed(1):"—";
  return `<article class="record-item">
   <div class="record-main"><div class="record-point">P${escape(row.point_id)}</div><div class="record-tree"><b translate="no">${escape(row.species)||"—"}</b><span>${escape(row.grp)||"—"}</span></div></div>
   <div class="record-metrics"><div><span>Çevre</span><b>${girth} cm</b></div><div><span>DBH</span><b>${dbh} cm</b></div><div><span>Boy</span><b>${height} m</b></div><div><span>Karbon</span><b>${(Number(row.carbon_kg)||0).toFixed(1)} kg C</b></div></div>
   <div class="record-side"><span class="badge ${status.cls}">${escape(status.label)}</span><div class="record-photo">${thumbnail(row.photo_url)}</div><div class="record-actions"><button class="btn sm blue" data-record-action="edit" data-record-id="${escape(row.id)}" aria-label="P${escape(row.point_id)} kaydını düzenle" data-i18n-aria-label="P{point} kaydını düzenle" data-i18n-values="${escape(JSON.stringify({point:row.point_id}))}">✏️ Düzenle</button><button class="btn sm red" data-record-action="delete" data-record-id="${escape(row.id)}" aria-label="P${escape(row.point_id)} kaydını sil" data-i18n-aria-label="P{point} kaydını sil" data-i18n-values="${escape(JSON.stringify({point:row.point_id}))}">Sil</button></div></div>
  </article>`;
 }
 root.DG_RECORD_ITEM_UI=Object.freeze({render,bind});
})(window);
