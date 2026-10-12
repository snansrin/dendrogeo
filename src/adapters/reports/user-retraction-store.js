"use strict";

window.DG_USER_RETRACTION_STORE = (() => {
  async function load(client, parkId) {
    try {
      const { data, error } = await client.from("report_retractions")
        .select("id,report_id,park_id,reason,status,requested_by,created_at")
        .eq("park_id", parkId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data || [];
    } catch (_error) {
      return [];
    }
  }

  return Object.freeze({ load });
})();
