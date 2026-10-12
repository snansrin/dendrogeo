"use strict";

window.DG_REPORT_PUBLICATION_CANCEL_STORE = (() => {
  async function cancel(client, requestId, cancelledAt) {
    return await client.from("report_requests")
      .update({ status: "Vazgeçildi", cancelled_at: cancelledAt })
      .eq("id", requestId);
  }

  return Object.freeze({ cancel });
})();
