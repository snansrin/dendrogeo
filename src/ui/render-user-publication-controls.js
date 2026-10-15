"use strict";

window.DG_RENDER_USER_PUBLICATION_CONTROLS = (() => {
  const bindings = new WeakSet();
  const actionsByElement = new WeakMap();

  function bind(root, actions) {
    if (!root || typeof root.addEventListener !== "function") return;
    actionsByElement.set(root, actions || {});
    if (bindings.has(root)) return;
    bindings.add(root);
    root.addEventListener("click", event => {
      const control = event.target?.closest?.("[data-user-publication-action]");
      if (!control || !root.contains(control)) return;
      const handler = actionsByElement.get(root)?.[control.dataset.userPublicationAction];
      if (typeof handler === "function") handler(control);
    });
  }

  function render(view, state, ports) {
    const actions = [];
    if (view.url) {
      actions.push('<button type="button" class="btn sm blue" data-user-publication-action="open" data-report-id="' + ports.escape(view.reportId) + '" title="Raporu yeni sekmede aç">🔗 Aç</button>');
      actions.push('<button type="button" class="btn sm" data-user-publication-action="share" data-report-id="' + ports.escape(view.reportId) + '" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
    }
    if (view.publication && !view.retractionPending) actions.push('<button type="button" class="btn sm red" data-user-publication-action="retract" data-report-id="' + ports.escape(view.reportId) + '" data-park-id="' + Number(state.parkId) + '" title="Yayını geri çek: veri dosyaları kaldırılır, adresinde gerekçeli bildirim kalır (kendi parkın olmalı)">🗑 Geri çek</button>');
    if (view.pending && view.pendingOwn) actions.push('<button type="button" class="btn sm red" data-user-publication-action="cancel" data-request-id="' + ports.escape(view.pending.id) + '" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
    if (!view.pending && !view.retractionPending) actions.push('<button type="button" class="btn sm amber" data-user-publication-action="publish" data-park-id="' + Number(state.parkId) + '" title="'
      + (view.url ? "Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır" : "Parkın bilimsel raporunu yayınla") + '">'
      + (view.url ? "📄 Yeni sürüm" : "📄 Yayınla") + "</button>");
    const landCover = !view.pending && !view.retractionPending
      ? '<label style="font-size:.78rem;color:var(--mut);display:inline-flex;gap:6px;align-items:center"><input type="checkbox" class="dg-switch" id="dgUserPubLulc" checked> 🛰 Arazi örtüsü bölümü (§5) dahil — önerilir</label>' : "";
    return '<div class="dg-act" style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + actions.join("") + landCover + "</div>";
  }

  return Object.freeze({ render, bind });
})();
