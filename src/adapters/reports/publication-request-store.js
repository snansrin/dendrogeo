"use strict";

window.DG_REPORT_PUBLICATION_REQUEST_STORE = (() => {
  async function load(client) {
    return await client.from("report_requests")
      .select("id,park_id,with_lulc,status,note,created_at,cancelled_at")
      .order("created_at", { ascending: false })
      .limit(50);
  }

  return Object.freeze({ load });
})();
