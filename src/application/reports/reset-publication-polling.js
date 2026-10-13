"use strict";

window.DG_RESET_PUBLICATION_POLLING = (() => {
  const update = (state, patch) => state && typeof state.setState === "function"
    ? state.setState(patch)
    : Object.assign(state, patch);

  function reset(adminState, userState) {
    update(adminState, { pollCount: 0 });
    update(userState, { polls: 0 });
  }

  return Object.freeze({ reset });
})();
