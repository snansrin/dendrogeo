"use strict";

/* Pure policy for deciding whether an administrator queue still needs polling. */
window.DG_HAS_PENDING_PUBLICATION_WORK = Object.freeze({
  check(state, { entryFor, retractionDone }) {
    const requests = state && Array.isArray(state.requests) ? state.requests : [];
    const retractions = state && Array.isArray(state.retractions) ? state.retractions : [];
    return requests.some(request => request.status === "Beklemede" && !entryFor(request.id))
      || retractions.some(request => request.status === "Beklemede" && !retractionDone(request.id));
  },
});
