"use strict";

window.DG_REPORT_RETRACTION_INSERT_STORE = (() => {
  async function insert(client, { fetch: fetcher, supabaseUrl, anonKey, reportId, parkId, reason, userId }) {
    let token = anonKey;
    try {
      const { data } = await client.auth.getSession();
      if (data && data.session && data.session.access_token) token = data.session.access_token;
    } catch (_error) {}

    try {
      const response = await fetcher(supabaseUrl + "/rest/v1/report_retractions", {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify([{
          report_id: String(reportId),
          park_id: Number(parkId),
          reason: reason || null,
          status: "Beklemede",
          requested_by: userId || null,
        }]),
      });
      const ok = response.status === 201 || response.status === 200;
      const text = ok ? "" : ((await response.text().catch(() => "")) || "");
      return { ok, status: response.status, txt: text };
    } catch (error) {
      return { ok: false, status: 0, txt: "NETWORK " + ((error && error.message) || error) };
    }
  }

  return Object.freeze({ insert });
})();
