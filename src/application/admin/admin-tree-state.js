"use strict";

/* Feature-scoped state shared by the administrator measurement-tree workflows. */
window.DG_ADMIN_TREE_STATE = (() => {
  const defaults = { status: "", query: "", openKeys: new Set() };

  function create(initial = {}) {
    let state = Object.freeze({ ...defaults, ...initial, openKeys: new Set(initial.openKeys || defaults.openKeys) });
    const listeners = new Set();

    function getState() { return state; }
    function setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      if (!next || typeof next !== "object") return state;
      state = Object.freeze({
        ...state,
        ...next,
        ...(Object.hasOwn(next, "openKeys") ? { openKeys: new Set(next.openKeys || []) } : {}),
      });
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
