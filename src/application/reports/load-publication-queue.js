"use strict";

window.DG_LOAD_PUBLICATION_QUEUE = (() => {
  const read = state => state && typeof state.getState === "function" ? state.getState() : state;
  const update = (state, patch) => state && typeof state.setState === "function"
    ? state.setState(patch)
    : Object.assign(state, patch);

  async function execute(state, options, ports) {
    if (!ports.hasView() || read(state).loading) return;
    update(state, { loading: true });
    if (!(options && options.silent)) ports.showLoading();
    try {
      const [parks, requests, queue, retractions] = await Promise.all([
        ports.loadParks(), ports.loadRequests(), ports.loadQueue(), ports.loadRetractions(),
      ]);
      const patch = { parks, requests, retractions, queueAt: ports.now() };
      if (queue) patch.queue = queue;
      update(state, patch);
    } catch (error) {
      update(state, { error: "Kuyruk yüklenemedi: " + ((error && error.message) || error) });
    } finally {
      update(state, { loading: false });
    }
    ports.render();
    ports.schedulePoll();
  }

  return Object.freeze({ execute });
})();
