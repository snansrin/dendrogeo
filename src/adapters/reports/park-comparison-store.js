"use strict";

window.DG_REPORT_PARK_COMPARISON_STORE = (() => {
  async function load(client) {
    const { data, error } = await client.from("v_park_compare")
      .select("*")
      .order("carbon_kg", { ascending: false });
    if (error || !data) return [];
    return data.filter(row => Number(row.park_id) > 0 && !row.park_pending && Number(row.records) > 0);
  }

  return Object.freeze({ load });
})();
