"use strict";

window.DG_SUMMARIZE_PUBLICATION_QUEUE = (() => {
  function summarize(state, publishedByPark, ports) {
    const queueEntries = (state.queue && state.queue.entries) || [];
    const pending = state.requests.filter(request => {
      if (request.status !== "Beklemede") return false;
      const entry = ports.entryFor(request.id);
      return !entry || entry.status === "Başarısız";
    }).length;
    const activePublished = Object.values(publishedByPark);
    const doiCount = activePublished.filter(entry => ports.isDoi(entry.doi)).length;
    const latestByRequest = new Map();
    for (const entry of queueEntries) if (entry.request_id) latestByRequest.set(String(entry.request_id), entry);
    const unresolvedFails = [...latestByRequest.values()].filter(entry => entry.status === "Başarısız");
    const latestFail = unresolvedFails.at(-1);
    const failBanner = latestFail
      ? '<div class="alert err admin-publish-error"><b>Son yayın denemesi başarısız.</b> '
        + ports.escape(latestFail.park_name || ("park #" + latestFail.park_id)) + " · "
        + ports.escape(String(latestFail.message || "üretim hatası").slice(0, 180))
        + '<small>istek ' + ports.escape(String(latestFail.request_id || "").slice(0, 8)) + " · sistem otomatik yeniden dener</small></div>" : "";
    return Object.freeze({ pending, activeCount: activePublished.length, doiCount, failedCount: unresolvedFails.length, failBanner });
  }

  return Object.freeze({ summarize });
})();
