"use strict";

window.DG_SCHEDULE_PUBLICATION_QUEUE_POLL = (() => {
  function execute(state, ports) {
    if (state.pollTimer) {
      ports.clearTimer(state.pollTimer);
      state.pollTimer = 0;
    }
    const waiting = state.requests.some(request => request.status === "Beklemede" && !ports.entryFor(request.id))
      || (state.retractions || []).some(request => request.status === "Beklemede" && !ports.retractionDone(request.id));
    if (!waiting || state.pollCount >= ports.maxPolls) return;
    state.pollTimer = ports.setInterval(async () => {
      state.pollCount++;
      if (!ports.isAdminViewActive() || ports.isDocumentHidden()) return;
      await ports.refresh();
    }, ports.intervalMs);
  }

  return Object.freeze({ execute });
})();
