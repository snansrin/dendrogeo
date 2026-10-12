"use strict";

window.DG_RENDER_PUBLICATION_PARK_ROW = (() => {
  function render(park, view, ports) {
    const badge = view.status === "published" ? '<span class="badge on">Yayınlandı</span>'
      : view.status === "pending" ? '<span class="badge admin">Beklemede</span>'
      : view.status === "retracting" ? '<span class="badge admin">Geri çekiliyor</span>'
      : view.status === "retracted" ? '<span class="badge off">Geri çekildi</span>'
      : view.status === "failed" ? '<span class="badge off">Başarısız</span>'
      : view.status === "cancelled" ? '<span class="badge off">Vazgeçildi</span>'
      : '<span class="badge off">Yayın yok</span>';
    const url = ports.url(view.reportId);
    const actions = [];
    if (view.status === "pending") {
      actions.push('<button class="btn sm red" onclick="dgPublishCancel(\'' + ports.escape(view.request.id) + '\')" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
    } else {
      if (url) {
        actions.push('<button class="btn sm blue" onclick="dgReportOpen(\'' + view.reportId + '\')" title="Raporu yeni sekmede aç">🔗 Aç</button>');
        actions.push('<button class="btn sm" onclick="dgReportShare(\'' + view.reportId + '\')" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
        if (view.publication && ports.isDoi(view.publication.doi)) actions.push('<a class="btn sm ghost" href="https://doi.org/' + ports.escape(view.publication.doi) + '" target="_blank" rel="noopener" title="Zenodo DOI kaydını aç">DOI</a>');
      }
      if (view.status === "published") actions.push('<button class="btn sm red" onclick="dgReportRetract(\'' + view.reportId + '\',' + Number(park.park_id) + ')" title="Yayını geri çek: veri dosyaları kaldırılır, adresinde gerekçeli bildirim kalır; kimlik yeniden kullanılmaz">🗑 Geri çek</button>');
      if (!view.retractionPending) actions.push('<button class="btn sm amber" onclick="dgPublishReport(' + Number(park.park_id) + ')" title="'
        + (view.status === "published" ? "Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır" : "Bilimsel raporu yayınla") + '">'
        + (view.status === "published" ? "📄 Yeni sürüm" : "📄 Yayınla") + "</button>");
    }

    return "<tr>"
      + '<td data-label="Park"><b>' + ports.escape(park.park_name) + "</b>"
      + '<div class="dg-tree-meta">' + ports.escape(park.city || "—") + " · " + Number(park.species_n || 0) + " " + ports.translate("tür") + " · " + Number(park.contributors || 0) + " " + ports.translate("katkı") + "</div></td>"
      + '<td data-label="Kayıt" class="mono">' + Number(park.records || 0) + "</td>"
      + '<td data-label="Karbon">' + (Number(park.carbon_kg || 0) / 1000).toFixed(2) + " t</td>"
      + '<td data-label="Alan">' + ports.area(park.area_m2) + "</td>"
      + '<td data-label="Yayın durumu">' + badge + '<div class="dg-tree-meta">' + view.note + "</div></td>"
      + '<td data-label="İşlem"><div class="dg-act">' + actions.join("") + "</div></td></tr>";
  }

  return Object.freeze({ render });
})();
