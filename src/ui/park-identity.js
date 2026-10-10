"use strict";
/* Present park identity and manual-entry controls from supplied state. */
(function(root){
function renderManualParkForm({open,point:pt}){
  return `<div id="manualParkBox" style="display:${open?"block":"none"};margin-top:12px;border-top:1px solid var(--line);padding-top:12px">`+
    `<div class="lbl">ELLE PARK OLUŞTUR</div>`+
    `<div class="alert info" style="margin:6px 0;font-size:.8rem">OSM'de park sınırı yoksa buradan kimlik aç. `+
    `Nokta: <b class="mono">${pt&&Number.isFinite(+pt.lat)?(+pt.lat).toFixed(5)+", "+(+pt.lon).toFixed(5):"haritada parkın içine tıkla veya GPS'i aç"}</b></div>`+
    `<div class="grid g2" style="gap:8px">`+
      `<div><div class="lbl">PARK ADI</div><input id="manualParkName" class="dg-png-input" placeholder="örn. Göksu Parkı"></div>`+
      `<div><div class="lbl">ALAN (HA, opsiyonel)</div><input id="manualParkArea" class="dg-png-input" type="number" step="0.1" placeholder="örn. 42.5"></div>`+
    `</div>`+
    `<button class="btn sm amber" style="margin-top:10px" onclick="dgCreateManualPark()">✓ Parkı Oluştur</button>`+
  `</div>`;
}

function renderParkIdentityChip({parkRow,escape:esc}){
  if(!parkRow){
    return `<span class="dg-png-badge" style="background:rgba(220,38,38,.12);color:#b91c1c" title="Park kimliği sunucuya yazılamadı">⚠ kimlik yok</span>`;
  }
  const src=parkRow.source==="manual"?"elle":(parkRow.source==="backfill"?"geri doldurma":"OSM");
  return `<span class="dg-png-badge" title="${esc(parkRow.osm_key||"")}">kimlik #${parkRow.id} · ${esc(src)}</span>`;
}

  root.DG_PARK_IDENTITY_UI=Object.freeze({manualForm:renderManualParkForm,chip:renderParkIdentityChip});
})(window);
