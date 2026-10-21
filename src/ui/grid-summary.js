"use strict";

/* Render the grid summary from supplied state; the engine owns its inputs. */
const gridSummaryBindings=new WeakSet(),gridSummaryActionsByElement=new WeakMap();
function bindGridSummaryActions(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  gridSummaryActionsByElement.set(element,actions||{});
  if(gridSummaryBindings.has(element))return;
  gridSummaryBindings.add(element);
  element.addEventListener("click",event=>{
    const control=event.target?.closest?.("[data-grid-summary-action]");
    if(!control||!element.contains(control)||control.disabled)return;
    gridSummaryActionsByElement.get(element)?.[control.dataset.gridSummaryAction]?.(control,event);
  });
}
function dgRenderGridSummary({ element, size, total, measured, empty, selected, meta, translate, translateFormat, actions }) {
  if (!element) return;
  element.style.display = "block";
  const pct = value => total ? Math.round(value / total * 100) : 0;
  element.innerHTML =
    `<b>📊 Grid</b> · ${size}×${size} m<br>`+
    `${translate("Toplam:")} <b>${total}</b> · `+
    `🟢 ${translate("Ölçülmüş:")} ${measured} (%${pct(measured)}) · `+
    `🔴 ${translate("Boş:")} ${empty} (%${pct(empty)})<br>`+
    (selected > 0 ? `<b style="color:#1d4ed8">🔵 ${translate("Seçili:")} ${selected}</b><br>` : "")+
    `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">`+
    (empty > 0 ? `<button type="button" class="btn sm blue" data-grid-summary-action="createAuto">${translateFormat("📍 Otomatik ({n})",{n:empty})}</button>` : "")+
    (selected > 0 ? `<button type="button" class="btn sm" style="background:#1d4ed8;color:#fff" data-grid-summary-action="createManual">${translateFormat("📍 Seçili ({n})",{n:selected})}</button>` : "")+
    (selected > 0 ? `<button type="button" class="btn sm ghost" data-grid-summary-action="clearSelection">✕ Seçimi Temizle</button>` : "")+
    `<button type="button" class="btn sm ghost" data-grid-summary-action="downloadGeoJson">📥 GeoJSON</button>`+
    `<button type="button" class="btn sm ghost" data-grid-summary-action="downloadCsv">${translate("📥 Ölçüm noktaları CSV")}</button>`+
    `</div>`+meta;
  bindGridSummaryActions(element,actions);
}

window.DG_GRID_SUMMARY = Object.freeze({ render: dgRenderGridSummary });
