"use strict";

window.DG_RESOLVE_PUBLICATION_PARK_STATUS = (() => {
  function resolve(park, state, ports) {
    const parkId = String(park.park_id);
    const request = state.requests.find(row => {
      if (String(row.park_id) !== parkId || row.status !== "Beklemede") return false;
      const previous = ports.entryFor(row.id);
      return !previous || previous.status === "Başarısız";
    });
    const last = state.requests.find(row => String(row.park_id) === parkId
      && !(state.queue?.archived_request_ids || []).includes(String(row.id)));
    const publication = ports.publishedByPark[parkId];
    const retractionPending = (state.retractions || []).find(row => String(row.park_id) === parkId
      && row.status === "Beklemede" && !ports.retractionDone(row.id));
    const retracted = ports.retractedInPark(parkId);
    let status = "none", reportId = "", note = "";

    if (request) {
      status = "pending";
      const previous = ports.entryFor(request.id);
      if (previous && previous.status === "Başarısız") note = "⚠ Önceki deneme başarısız · otomatik yeniden denenecek (en fazla 3 deneme)";
      else note = ports.escape(ports.status(request).note) + " · yayın işi 5 dakikada bir çalışır";
    } else if (publication) {
      status = retractionPending ? "retracting" : "published";
      reportId = publication.report_id;
      const doiNote = ports.isDoi(publication.doi) ? " · DOI " + ports.escape(publication.doi)
        : (publication.doi_status === "Başarısız" ? " · DOI tekrar denenecek" : " · DOI sırada");
      note = retractionPending ? ports.translate("🗑 geri çekme isteği kuyrukta — birkaç dakika içinde yayından kalkar")
        : ports.escape(reportId || "—") + (publication.finished_at
          ? " · " + ports.translate("yayın") + " " + String(publication.finished_at).slice(0, 10) : "") + doiNote;
    } else if (retractionPending) {
      status = "retracting";
      reportId = ports.isReportId(retractionPending.report_id) ? String(retractionPending.report_id) : "";
      note = "🗑 " + ports.escape(reportId || ports.translate("rapor")) + " " + ports.translate("geri çekme kuyruğunda");
    } else if (retracted) {
      status = "retracted";
      note = "🗑 " + ports.escape(ports.isReportId(retracted.report_id) ? String(retracted.report_id) : ports.translate("rapor"))
        + " " + ports.translate("geri çekildi")
        + (retracted.finished_at ? " · " + String(retracted.finished_at).slice(0, 10) : "")
        + (retracted.reason ? " · " + ports.escape(String(retracted.reason).slice(0, 60)) : "");
    } else if (last) {
      const result = ports.status(last);
      status = result.key;
      reportId = result.reportId || "";
      note = (result.key === "failed" ? "⚠ " : "") + ports.escape(String(result.note || "").slice(0, 140));
    }

    return Object.freeze({ parkId, request, publication, retractionPending, status, reportId, note });
  }

  return Object.freeze({ resolve });
})();
