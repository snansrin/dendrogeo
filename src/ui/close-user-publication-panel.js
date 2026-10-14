"use strict";

window.DG_CLOSE_USER_PUBLICATION_PANEL = (() => {
  function execute(state, ports) {
    if (state.timer) {
      ports.clearTimer(state.timer);
      state.timer = 0;
    }
    state.projectId = 0;
    state.parkId = 0;
    const box = ports.getBox();
    if (box) {
      box.style.display = "none";
      box.innerHTML = "";
    }
  }

  return Object.freeze({ execute });
})();
