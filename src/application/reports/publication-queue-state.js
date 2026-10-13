"use strict";

/* Feature-scoped, single-source state for the administrator publication queue. */
window.DG_PUBLICATION_QUEUE_STATE = (() => {
  const defaults = {
    parks: [], requests: [], retractions: [], queue: null, queueAt: 0,
    error: "", loading: false, pollTimer: 0, pollCount: 0,
  };

  function create(initial = {}) {
    let state = Object.freeze({ ...defaults, ...initial });
    const listeners = new Set();

    function getState() { return state; }
    function setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      if (!next || typeof next !== "object") return state;
      state = Object.freeze({ ...state, ...next });
      for (const listener of [...listeners]) listener(state);
      return state;
    }
    function subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return Object.freeze({ getState, setState, subscribe });
  }

  return Object.freeze({ create });
})();
