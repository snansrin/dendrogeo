"use strict";

window.DG_RESET_PUBLICATION_POLLING = (() => {
  function reset(adminState, userState) {
    adminState.pollCount = 0;
    userState.polls = 0;
  }

  return Object.freeze({ reset });
})();
