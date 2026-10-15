"use strict";
(function(root){
 const bindings=new WeakSet(),actionsByDocument=new WeakMap();
 function bind(document,actions){if(!document||typeof document.addEventListener!=="function")return;actionsByDocument.set(document,actions||{});if(bindings.has(document))return;bindings.add(document);document.addEventListener("click",event=>{const button=event.target?.closest?.('[data-park-comparison-action="scan"]');if(button&&document.contains(button))actionsByDocument.get(document)?.scan?.();});}
 function render(pending,{isAdmin,escape,document,actions}){
  bind(document,actions);
  if(!pending||!pending.length)return "";
  const count=pending.reduce((sum,row)=>sum+(Number(row.records)||0),0);
  return `
  <div class="dg-pend-wrap">
   <div class="lbl dg-pend-head">⚠ PARK ALGILANMAMIŞ KAYITLAR <span class="dg-pend-sub">(sıralamaya dahil değil · ${count} kayıt)</span></div>
   ${pending.map(park=>`
    <div class="dg-pend-row">
     <div class="dg-pend-main">
      <div class="dg-pend-name">${escape(park.park_name)} <span class="badge off">park yok</span></div>
      <div class="dg-cmp-meta">${escape(park.city||"—")} · ${park.records} kayıt · ${(Number(park.carbon_kg)/1000).toFixed(2)} t</div>
     </div>
     ${isAdmin?`<button class="btn sm ghost dg-pend-act" data-park-comparison-action="scan">🌳 Park Algıla</button>`:`<span class="badge admin dg-pend-act">🔐 yönetici bağlayacak</span>`}
    </div>`).join("")}
   <div class="dg-pend-note">${isAdmin
     ?`Bu kayıtlar park kimliği oluşturulmadan önce girilmiş. <b>🌳 Parkları Geri Doldur</b> aracı ölçüm merkezinden otomatik eşleştirir; tek tek bağlamak için satırdaki 🌳 düğmesini kullan.`
     :`Bu kayıtlar park kimliği oluşturulmadan önce girilmiş. Parka bağlama işlemi <b>yalnız yönetici</b> tarafından yapılır — yönetici eşleştirdiğinde bu satırlar yukarıdaki park sıralamasına taşınır.`}</div>
  </div>`;
 }
 root.DG_PARK_COMPARISON_PENDING=Object.freeze({render,bind});
})(window);
