"use strict";

window.DG_LOAD_USER_PUBLICATION = (() => {
  async function execute(state, ports) {
    if (!state.parkId) return;

    try {
      const { data, error } = await ports.loadRequests(state.parkId);
      if (error) {
        state.error = ports.requestError(error, false);
        state.requests = [];
      } else {
        state.error = "";
        state.requests = data || [];
      }
    } catch (error) {
      state.error = ports.requestError(error, true);
      state.requests = [];
    }

    const [queue, ownApproved, retractions] = await Promise.all([
      ports.loadQueue(),
      ports.loadOwnApproved(),
      ports.loadRetractions(),
    ]);
    if (queue) state.queue = queue;
    state.ownApproved = ownApproved;
    state.retracts = retractions || [];
    ports.render();
    ports.schedulePoll();
  }

  return Object.freeze({ execute });
})();
