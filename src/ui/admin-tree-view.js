"use strict";

window.DG_ADMIN_TREE_VIEW = (() => {
  function render({ element, tree, rows, status, query, error, escape, translate, tons, parkHTML }) {
    if (!element) return;
    if (error) {
      element.innerHTML = `<div class="alert err"><b>⚠ Ölçümler okunamadı — veri silinmedi, sorgu hata veriyor.</b>` +
        `<div class="mono" style="font-size:.72rem;margin-top:6px;word-break:break-word">${escape(error)}</div>` +
        `<div style="font-size:.8rem;margin-top:8px">Olası sebepler: (1) şema değişikliğinden sonra PostgREST önbelleği bayat → Supabase'de ` +
        `<b>Database → Restart</b> ya da birkaç dakika bekle; (2) 0004 migration'ı eksik; (3) RLS/rol sorunu. Hatayı olduğu gibi paylaşman yeterli.</div>` +
        `<button class="btn sm blue" style="margin-top:10px" onclick="loadAdminTree()">🔄 Yeniden dene</button></div>`;
      return;
    }
    if (!tree.length) {
      element.innerHTML = `<div class="alert info">${translate("Bu filtreye uyan kayıt yok.")} (` +
        `${translate("Toplam")} ${rows.length} ${translate("kayıt çekildi")}${status ? " · " + translate("durum") + ": " + escape(status) : ""}` +
        `${query ? " · " + translate("arama") + ": " + escape(query) : ""})</div>`;
      return;
    }
    const parkCount = tree.filter(park => !park.pending).length;
    const projectCount = tree.reduce((total, park) => total + park.projects.length, 0);
    const recordCount = tree.reduce((total, park) => total + park.n, 0);
    const carbon = tree.reduce((total, park) => total + park.c, 0);
    element.innerHTML = `<div class="dg-tree-sum mono">🌳 ${parkCount} ${translate("park")} · 📁 ${projectCount} ${translate("proje")} · 📋 ${recordCount} ${translate("kayıt")} · ⚖ ${tons(carbon)}` +
      ` <button class="btn sm ghost dg-tree-act" onclick="dgTreeExpand(true)">Tümünü aç</button>` +
      ` <button class="btn sm ghost dg-tree-act" onclick="dgTreeExpand(false)">Tümünü kapat</button></div>` + tree.map(parkHTML).join("");
  }
  return Object.freeze({ render });
})();
