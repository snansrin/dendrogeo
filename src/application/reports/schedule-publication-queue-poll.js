"use strict";

window.DG_SCHEDULE_PUBLICATION_QUEUE_POLL = (() => {
  const read = state => state && typeof state.getState === "function" ? state.getState() : state;
  const update = (state, patch) => state && typeof state.setState === "function"
    ? state.setState(patch)
    : Object.assign(state, patch);

  function execute(state, ports) {
    let current = read(state);
    if (current.pollTimer) {
      ports.clearTimer(current.pollTimer);
      update(state, { pollTimer: 0 });
      current = read(state);
    }
    const pending = typeof ports.hasPending === "function"
      ? ports.hasPending(current)
      : current.requests.some(request => request.status === "Beklemede" && !ports.entryFor(request.id))
        || (current.retractions || []).some(request => request.status === "Beklemede" && !ports.retractionDone(request.id));
    if (!pending || current.pollCount >= ports.maxPolls) return;
    const timer = ports.setInterval(async () => {
      const latest = read(state);
      update(state, { pollCount: latest.pollCount + 1 });
      if (!ports.isAdminViewActive() || ports.isDocumentHidden()) return;
      await ports.refresh();
    }, ports.intervalMs);
    update(state, { pollTimer: timer });
  }

  return Object.freeze({ execute });
})();
