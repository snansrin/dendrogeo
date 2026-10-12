"use strict";

window.DG_SCHEDULE_USER_PUBLICATION_POLL = (() => {
  function execute(state, ports) {
    if (state.timer) {
      ports.clearTimer(state.timer);
      state.timer = 0;
    }

    const mine = ports.userId() || "";
    const waiting = state.requests.some(request => request.status === "Beklemede"
      && String(request.requested_by || "") === String(mine)
      && !ports.entryFor(state.queue, request.id))
      || (state.retracts || []).some(request => request.status === "Beklemede"
        && String(request.requested_by || "") === String(mine)
        && !ports.retractionDone(state.queue, request.id));
    if (!waiting || state.polls >= ports.maxPolls) return;

    state.timer = ports.setInterval(async () => {
      state.polls++;
      if (!ports.isProjectsTabActive() || ports.isDocumentHidden() || !ports.isPanelVisible()) return;
      await ports.refresh();
    }, ports.intervalMs);
  }

  return Object.freeze({ execute });
})();
