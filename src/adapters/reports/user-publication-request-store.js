"use strict";

window.DG_USER_PUBLICATION_REQUEST_STORE = (() => {
  async function load(client, parkId) {
    return await client.from("report_requests")
      .select("id,park_id,with_lulc,status,requested_by,created_at,cancelled_at")
      .eq("park_id", parkId)
      .order("created_at", { ascending: false })
      .limit(10);
  }

  return Object.freeze({ load });
})();
