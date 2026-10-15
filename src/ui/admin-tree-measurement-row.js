"use strict";

window.DG_ADMIN_TREE_MEASUREMENT_ROW = (() => {
  function render(row, ports) {
    const status = row.status || "Beklemede";
    const actions = status === "Onaylı"
      ? `<button type="button" class="btn sm red" data-admin-measurement-action="reject" data-measurement-id="${ports.escape(row.id)}">🚫 Reddet</button>`
      : `<button type="button" class="btn sm" data-admin-measurement-action="approve" data-measurement-id="${ports.escape(row.id)}">✓ Onayla</button>`;
    const created = row.created_at ? new Date(row.created_at) : null;
    return `<tr data-mid="${ports.escape(row.id)}">` +
      `<td data-label="Nokta"><b>P${ports.escape(row.point_id)}</b>${row.measurement_no > 1 ? `<span class="mono dg-sub"> /M${row.measurement_no}</span>` : ""}</td>` +
      `<td data-label="Tür">${ports.escape(row.species || "—")}<br><span class="mono dg-sub">${ports.escape(ports.latin[row.species] || "")}</span></td>` +
      `<td data-label="Grup">${ports.escape(row.grp || "—")}</td>` +
      `<td data-label="DBH">${Number.isFinite(+row.dbh_cm) ? (+row.dbh_cm).toFixed(1) : "—"}${row.girth_cm != null && Number(row.girth_cm) > 0 ? `<br><span class="mono dg-sub" title="Sahada ölçülen ham göğüs çevresi">çevre: ${(+row.girth_cm).toFixed(1)} cm</span>` : ""}</td>` +
      `<td data-label="Boy">${row.height_m ?? "—"}</td>` +
      `<td data-label="Karbon kg"><b>${(Number(row.carbon_kg) || 0).toFixed(1)}</b></td>` +
      `<td data-label="Foto">${ports.thumbnail(row.photo_url)}</td>` +
      `<td data-label="Durum">${ports.badge(status)}</td>` +
      `<td data-label="Tarih" class="mono dg-sub">${created ? created.toLocaleDateString("tr-TR") : "—"}</td>` +
      `<td data-label="İşlem"><div class="dg-act">${actions}<button type="button" class="btn sm red" data-admin-measurement-action="delete" data-measurement-id="${ports.escape(row.id)}">🗑️</button></div></td></tr>`;
  }
  return Object.freeze({ render });
})();
