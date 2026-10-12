"use strict";

window.DG_REPORT_RETRACTION_STORE = (() => {
  async function load(client) {
    try {
      const { data, error } = await client.from("report_retractions")
        .select("id,report_id,park_id,reason,status,requested_by,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    } catch (_error) {
      return [];
    }
  }

  return Object.freeze({ load });
})();
