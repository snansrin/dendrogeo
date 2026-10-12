"use strict";

window.DG_LOAD_PUBLICATION_QUEUE = (() => {
  async function execute(state, options, ports) {
    if (!ports.hasView() || state.loading) return;
    state.loading = true;
    if (!(options && options.silent)) ports.showLoading();
    try {
      const [parks, requests, queue, retractions] = await Promise.all([
        ports.loadParks(), ports.loadRequests(), ports.loadQueue(), ports.loadRetractions(),
      ]);
      state.parks = parks;
      state.requests = requests;
      state.retractions = retractions;
      if (queue) state.queue = queue;
      state.queueAt = ports.now();
    } catch (error) {
      state.error = "Kuyruk yüklenemedi: " + ((error && error.message) || error);
    } finally {
      state.loading = false;
    }
    ports.render();
    ports.schedulePoll();
  }

  return Object.freeze({ execute });
})();
