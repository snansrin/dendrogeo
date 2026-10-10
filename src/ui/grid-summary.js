"use strict";

/* Render the grid summary from supplied state; the engine owns its inputs. */
function dgRenderGridSummary({ element, size, total, measured, empty, selected, meta, translate, translateFormat }) {
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
    (empty > 0 ? `<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">${translateFormat("📍 Otomatik ({n})",{n:empty})}</button>` : "")+
    (selected > 0 ? `<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">${translateFormat("📍 Seçili ({n})",{n:selected})}</button>` : "")+
    (selected > 0 ? `<button class="btn sm ghost" onclick="clearCellSelection()">✕ Seçimi Temizle</button>` : "")+
    `<button class="btn sm ghost" onclick="downloadGridGeoJSON()">📥 GeoJSON</button>`+
    `<button class="btn sm ghost" onclick="downloadWaypointsCSV()">📥 WP CSV</button>`+
    `</div>`+meta;
}

window.DG_GRID_SUMMARY = Object.freeze({ render: dgRenderGridSummary });
