"use strict";
/* Render the proposed park matches without changing the plan or writing data. */
(function(root){
const bindings=new WeakSet(),actionsByElement=new WeakMap();
function bindBackfillPlanActions(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  actionsByElement.set(element,actions||{});
  if(bindings.has(element))return;
  bindings.add(element);
  element.addEventListener("click",event=>{
    const control=event.target?.closest?.("[data-park-backfill-action]");
    if(!control||!element.contains(control))return;
    const action=actionsByElement.get(element)?.[control.dataset.parkBackfillAction];
    if(typeof action==="function")action(control);
  });
}
function renderBackfillPlan({box,plan=[],escape:esc,formatArea:dgFmtHa,translateFormat:_tprf}){
  if(!box)return;
  const ok=plan.filter(x=>x.durum==="eşleşti");
  const noPark=plan.filter(x=>x.durum==="OSM'de park yok");
  const noMeas=plan.filter(x=>x.durum==="ölçüm yok");

  box.style.display="block";
  box.innerHTML=
    `<div class="alert info" style="margin:6px 0">Plan: <b>${ok.length}</b> proje OSM parkıyla eşleşti · `+
    `<b>${noPark.length}</b> projede OSM parkı yok (satırdaki ✍️ ile elle oluştur) · `+
    `<b>${noMeas.length}</b> projede ölçüm yok.</div>`+
    `<div class="tblwrap" style="max-height:340px;overflow:auto"><table>`+
      `<thead><tr><th scope='col'>Proje (eski ad)</th><th scope='col'>Park</th><th scope='col'>Yeni ad</th><th scope='col'>Alan</th><th scope='col'>Nasıl bulundu</th><th scope='col'>Durum / İşlem</th></tr></thead><tbody>`+
      plan.map(x=>{
        const isOk=x.durum==="eşleşti";
        const act=isOk
          ? `<span class="badge on">✓ eşleşecek</span>`
          : (x.lat!=null
            ? `<span class="badge admin">${esc(x.durum)}</span> <button type="button" class="btn sm ghost" data-park-backfill-action="manual" data-project-id="${Number(x.project.id)}">✍️ Elle park oluştur ve bağla</button>`
            : `<span class="badge off">${esc(x.durum)}</span>`);
        return `<tr>`+
          `<td>${esc(x.project.name)}<br><span class="mono" style="font-size:.66rem;color:var(--mut)">${x.n||0} ölçüm${x.lat!=null?` · ${x.lat.toFixed(5)},${x.lon.toFixed(5)}`:""}</span></td>`+
          `<td>${esc(x.parkName||"—")}</td>`+
          `<td>${esc(x.newName||"—")}</td>`+
          `<td>${x.cand?dgFmtHa(x.cand.area):"—"}</td>`+
          `<td class="mono" style="font-size:.68rem">${esc(x.yol||"—")}</td>`+
          `<td>${act}</td>`+
        `</tr>`;
      }).join("")+
    `</tbody></table></div>`+
    `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">`+
      (ok.length?`<button type="button" class="btn amber" data-park-backfill-action="apply">${_tprf("✓ Planı Uygula ({n} proje)",{n:ok.length})}</button>`:``)+
      `<button type="button" class="btn sm ghost" data-park-backfill-action="close">Kapat</button>`+
    `</div>`+
    (ok.length?``:`<div class="alert warn" style="margin-top:8px">OSM'de eşleşen park çıkmadı. Satırlardaki <b>✍️ Elle park oluştur ve bağla</b> düğmesi, ölçüm merkezinde o proje adıyla bir park kimliği açar — karşılaştırma yine park bazlı çalışır.</div>`);
  bindBackfillPlanActions(box,{
    manual:control=>root.dgBackfillManual(Number(control.dataset.projectId)),
    apply:()=>root.dgApplyBackfill(),
    close:()=>root.dgCloseBackfill()
  });
}

  function close(document){const box=document.getElementById("backfillBox");if(box){box.style.display="none";box.innerHTML="";}}
  root.DG_PARK_BACKFILL_PLAN_UI=Object.freeze({render:renderBackfillPlan,close,bind:bindBackfillPlanActions});
})(window);
