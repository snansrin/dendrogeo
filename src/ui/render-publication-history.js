"use strict";

window.DG_RENDER_PUBLICATION_HISTORY = (() => {
  function render(queue, ports) {
    const retractedIds = ports.retractedIds(queue);
    return ((queue && queue.entries) || []).slice(-6).reverse().map(entry => {
      const ok = entry.status === "Yayınlandı";
      if (entry.status === "Geri çekildi") {
        const reportId = ports.isReportId(entry.report_id) ? entry.report_id : "—";
        return '<div class="admin-publish-log-item">'
          + "🗑 <b>" + ports.escape(reportId) + "</b> " + ports.translate("geri çekildi") + " · " + ports.escape(entry.park_name || ("park #" + entry.park_id))
          + (entry.reason ? " · gerekçe: " + ports.escape(String(entry.reason).slice(0, 80)) : "")
          + '<div class="dg-tree-meta">istek ' + ports.escape(String(entry.retraction_id || "").slice(0, 8)) + " · "
          + ports.escape(String(entry.finished_at || "").slice(0, 16).replace("T", " ")) + "</div></div>";
      }
      const url = ok && ports.isReportId(entry.report_id) && !retractedIds[String(entry.report_id)] ? ports.url(entry.report_id) : "";
      const reportId = ports.isReportId(entry.report_id) ? entry.report_id : "—";
      return '<div class="admin-publish-log-item">' + (ok ? "✅ " : "❌ ") + "<b>" + ports.escape(reportId) + "</b> · "
        + ports.escape(entry.park_name || ("park #" + entry.park_id))
        + (ok ? " · n=" + Number(entry.n || 0) + " · " + ports.escape(entry.carbon_txt || "") : " · " + ports.escape(String(entry.message || "").slice(0, 120)))
        + (url ? ' · <a href="' + ports.escape(url) + '" target="_blank" rel="noopener">bağlantı</a>' : "")
        + '<div class="dg-tree-meta">istek ' + ports.escape(String(entry.request_id || "").slice(0, 8)) + " · "
        + ports.escape(String(entry.finished_at || "").slice(0, 16).replace("T", " ")) + "</div></div>";
    }).join("");
  }

  return Object.freeze({ render });
})();
