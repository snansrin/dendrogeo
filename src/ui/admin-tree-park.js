"use strict";

window.DG_ADMIN_TREE_PARK = (() => {
  function render(park, ports) {
    const open = ports.openKeys.has(park.key) ? " open" : "";
    const projectCount = park.projects.length;
    const userCount = park.projects.reduce((total, project) => total + project.users.length, 0);
    const hectares = park.area_m2 ? ` · ${ports.formatHa(park.area_m2)}` : "";
    const carbonPerHa = park.area_m2 ? ` · ${((park.c / 1000) / (park.area_m2 / 10000)).toFixed(2)} t/ha` : "";
    return `<details class="dg-tree-park${park.pending ? " pending" : ""}"${open} ontoggle="dgTreeToggle('${park.key}',this.open)">` +
      `<summary>${park.pending ? "⚠" : "🌳"} <b>${ports.escape(park.name)}</b>${ports.pendingBadge(park.beklemede)}` +
      `<span class="dg-tree-meta">${ports.escape(park.city || "")}${hectares} · ${projectCount} ${ports.translate("proje")} · ${userCount} ${ports.translate("kullanıcı")} · ${park.n} ${ports.translate("kayıt")} · ${ports.tons(park.c)}${carbonPerHa}</span>` +
      (park.pending ? `<button class="btn sm ghost dg-tree-act" onclick="dgTreePendingScan(event)">🌳 Park Algıla</button>` : "") +
      `</summary><div class="dg-tree-body">${park.projects.map(ports.projectHTML).join("")}</div></details>`;
  }
  return Object.freeze({ render });
})();
