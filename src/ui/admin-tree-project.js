"use strict";

window.DG_ADMIN_TREE_PROJECT = (() => {
  function render(project, ports) {
    const open = ports.openKeys.has(project.key) ? " open" : "";
    const remove = ports.canDelete && project.project_id
      ? `<button class="btn sm red dg-tree-act" data-dg-admin-tree-action="delete-project" data-project-id="${project.project_id}" title="${ports.translate("Projeyi kalıcı olarak sil (ölçümler + waypoint'ler dahil)")}">🗑</button>` : "";
    return `<details class="dg-tree-proj"${open} ontoggle="dgTreeToggle('${project.key}',this.open)">` +
      `<summary>📁 <b>${ports.escape(project.name)}</b>${ports.pendingBadge(project.beklemede)}` +
      `<span class="dg-tree-meta">${project.users.length} ${ports.translate("kullanıcı")} · ${project.n} ${ports.translate("kayıt")} · ${ports.tons(project.c)}</span>${remove}</summary>` +
      `<div class="dg-tree-body">${project.users.map(ports.userHTML).join("")}</div></details>`;
  }
  return Object.freeze({ render });
})();
