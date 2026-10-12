"use strict";

window.DG_REFRESH_AFTER_REPORT_RETRACTION = (() => {
  async function execute(userState, ports) {
    if (ports.hasAdminView()) await ports.refreshAdmin();
    if (userState.parkId) await ports.refreshUser();
  }

  return Object.freeze({ execute });
})();
