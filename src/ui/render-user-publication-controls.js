"use strict";

window.DG_RENDER_USER_PUBLICATION_CONTROLS = (() => {
  function render(view, state, ports) {
    const actions = [];
    if (view.url) {
      actions.push('<button class="btn sm blue" onclick="dgReportOpen(\'' + view.reportId + '\')" title="Raporu yeni sekmede aç">🔗 Aç</button>');
      actions.push('<button class="btn sm" onclick="dgReportShare(\'' + view.reportId + '\')" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
    }
    if (view.publication && !view.retractionPending) actions.push('<button class="btn sm red" onclick="dgReportRetract(\'' + view.reportId + '\',' + state.parkId + ')" title="Yayını geri çek: veri dosyaları kaldırılır, adresinde gerekçeli bildirim kalır (kendi parkın olmalı)">🗑 Geri çek</button>');
    if (view.pending && view.pendingOwn) actions.push('<button class="btn sm red" onclick="dgUserCancel(\'' + ports.escape(view.pending.id) + '\')" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
    if (!view.pending && !view.retractionPending) actions.push('<button class="btn sm amber" onclick="dgUserPublish(' + state.parkId + ')" title="'
      + (view.url ? "Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır" : "Parkın bilimsel raporunu yayınla") + '">'
      + (view.url ? "📄 Yeni sürüm" : "📄 Yayınla") + "</button>");
    const landCover = !view.pending && !view.retractionPending
      ? '<label style="font-size:.78rem;color:var(--mut);display:inline-flex;gap:6px;align-items:center"><input type="checkbox" class="dg-switch" id="dgUserPubLulc" checked> 🛰 Arazi örtüsü bölümü (§5) dahil — önerilir</label>' : "";
    return '<div class="dg-act" style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + actions.join("") + landCover + "</div>";
  }

  return Object.freeze({ render });
})();
