"use strict";

window.DG_OWN_APPROVED_MEASUREMENTS_STORE = (() => {
  async function count(client, projectId, userId) {
    const { count } = await client.from("measurements")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("owner", userId)
      .eq("status", "Onaylı")
      .is("deleted_at", null);
    return Number(count || 0);
  }

  return Object.freeze({ count });
})();
