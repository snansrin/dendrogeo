"use strict";

window.DG_REQUEST_REPORT_RETRACTION = (() => {
  async function execute(reportId, parkId, ports) {
    if (!ports.isValidReportId(reportId)) return ports.onInvalidReport();
    if (!ports.isAuthenticated()) return ports.onUnauthenticated();
    if (!ports.confirm(reportId)) return;
    let reason = "";
    try { reason = ports.askReason() || ""; } catch (error) { reason = ""; }
    const result = await ports.insert(reportId, parkId, String(reason).slice(0, 400));
    if (result.ok) return await ports.onSuccess();
    return ports.onFailure(result);
  }

  return Object.freeze({ execute });
})();
