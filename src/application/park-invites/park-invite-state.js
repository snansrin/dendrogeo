"use strict";

/* Feature-scoped shared state for recipient and owner park-invite workflows. */
window.DG_PARK_INVITE_STATE = (() => {
  const defaults = { parks: null, invites: null, collabs: null, mine: null, received: [], loading: false };

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
