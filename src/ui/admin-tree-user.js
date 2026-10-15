"use strict";

window.DG_ADMIN_TREE_USER = (() => {
  function render(user, ports) {
    const open = ports.openKeys.has(user.key) ? " open" : "";
    return `<details class="dg-tree-user"${open} data-dg-admin-tree-node="${ports.escape(user.key)}">` +
      `<summary>👤 <b>${ports.escape(user.name)}</b>${ports.pendingBadge(user.beklemede)}` +
      `<span class="dg-tree-meta">${user.n} ${ports.translate("kayıt")} · ${ports.tons(user.c)} · ${ports.statusSummary(user)}</span></summary>` +
      `<div class="dg-tree-body tblwrap"><table class="dg-cards"><thead><tr><th scope='col'>Nokta</th><th scope='col'>Tür</th><th scope='col'>Grup</th><th scope='col'>Çap</th><th scope='col'>Boy</th><th scope='col'>Karbon kg</th><th scope='col'>Foto</th><th scope='col'>Durum</th><th scope='col'>Tarih</th><th scope='col'>İşlem</th></tr></thead>` +
      `<tbody>${user.rows.map(ports.rowHTML).join("")}</tbody></table></div></details>`;
  }
  return Object.freeze({ render });
})();
