"use strict";

window.DG_RESOLVE_USER_PUBLICATION_VIEW = (() => {
  function resolve(state, userId, ports) {
    const pending = state.requests.find(row => row.status === "Beklemede" && !ports.entryFor(state.queue, row.id));
    const pendingOwn = !!(pending && String(pending.requested_by || "") === String(userId || ""));
    const publication = ports.publishedInPark(state.queue, state.parkId);
    const retractionPending = (state.retracts || []).find(row => row.status === "Beklemede" && !ports.retractionDone(state.queue, row.id));
    const retracted = ports.retractedInPark(state.queue, state.parkId);
    const last = state.requests.find(row => !(state.queue?.archived_request_ids || []).includes(String(row.id))) || null;
    let badge, note = "";

    if (pending) {
      const age = Math.max(0, Math.round((ports.now() - new Date(pending.created_at || ports.now()).getTime()) / 60000));
      badge = '<span class="badge admin">Beklemede</span>';
      note = (age < 1 ? ports.translate("az önce") : age + " " + ports.translate("dk önce")) + " "
        + ports.translate("kuyruğa alındı") + " · " + ports.translate("yayın işi 5 dakikada bir çalışır")
        + (pendingOwn ? "" : " · " + ports.translate("isteği başka bir katkıda bulunan açtı"));
    } else if (retractionPending) {
      badge = '<span class="badge admin">Geri çekiliyor</span>';
      note = "🗑 " + (ports.isReportId(retractionPending.report_id) ? String(retractionPending.report_id) : ports.translate("rapor"))
        + " geri çekme kuyruğunda — birkaç dakika içinde yayından kalkar";
    } else if (publication) {
      badge = '<span class="badge on">Yayınlandı</span>';
    } else if (retracted) {
      badge = '<span class="badge off">Geri çekildi</span>';
      note = "🗑 " + (ports.isReportId(retracted.report_id) ? String(retracted.report_id) : ports.translate("rapor"))
        + " " + ports.translate("geri çekildi")
        + (retracted.finished_at ? " · " + String(retracted.finished_at).slice(0, 10) : "")
        + (retracted.reason ? " · " + String(retracted.reason).slice(0, 60) : "");
    } else if (last) {
      const entry = ports.entryFor(state.queue, last.id);
      if (entry && entry.status === "Başarısız") {
        badge = '<span class="badge off">Başarısız</span>';
        note = "⚠ " + String(entry.message || "üretim hatası").slice(0, 140);
      } else if (last.status === "Vazgeçildi") badge = '<span class="badge off">Vazgeçildi</span>';
      else badge = '<span class="badge off">Yayın yok</span>';
    } else badge = '<span class="badge off">Yayın yok</span>';

    const reportId = publication && ports.isReportId(publication.report_id) ? String(publication.report_id) : "";
    return Object.freeze({ pending, pendingOwn, publication, retractionPending, retracted, last, badge, note, reportId, url: ports.url(reportId) });
  }

  return Object.freeze({ resolve });
})();
