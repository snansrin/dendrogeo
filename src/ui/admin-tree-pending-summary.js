"use strict";

window.DG_ADMIN_TREE_PENDING_SUMMARY = (() => {
  function render({ box, rows, group, updateSidebarBadge, translate }) {
    const all = group(rows);
    const wait = all.reduce((total, park) => total + (park.beklemede || 0), 0);
    updateSidebarBadge(wait);
    if (!box || !box.style) return;
    if (!wait) { box.style.display = "none"; box.innerHTML = ""; return; }
    const parkCount = all.filter(park => park.beklemede > 0).length;
    const projectCount = all.reduce((total, park) => total + park.projects.filter(project => project.beklemede > 0).length, 0);
    const userCount = all.reduce((total, park) => total + park.projects.reduce((subtotal, project) =>
      subtotal + project.users.filter(user => user.beklemede > 0).length, 0), 0);
    box.style.display = "block";
    box.className = "alert warn";
    box.innerHTML = `<b>⏳ ${wait} ${translate("kayıt onay bekliyor")}</b> · 🌳 ${parkCount} ${translate("park")} · 📁 ${projectCount} ${translate("proje")} · 👤 ${userCount} ${translate("kullanıcı")}` +
      `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">` +
      `<button class="btn sm amber" data-dg-admin-tree-action="only-pending">🔴 Sadece bekleyenler</button>` +
      `<button class="btn sm ghost" data-dg-admin-tree-action="open-pending">Bekleyen düğümleri aç</button></div>`;
  }
  return Object.freeze({ render });
})();
