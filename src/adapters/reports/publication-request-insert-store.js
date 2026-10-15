"use strict";

window.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE = (() => {
  async function insert(client, options) {
    let token = options.anonKey;
    try {
      const { data } = await client.auth.getSession();
      if (data && data.session && data.session.access_token) token = data.session.access_token;
    } catch (error) { /* fall back to anon key; RLS still decides whether insert is allowed */ }

    try {
      const response = await options.fetch.call(globalThis, options.supabaseUrl + "/rest/v1/report_requests", {
        method: "POST",
        headers: {
          apikey: options.anonKey,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify([{
          park_id: Number(options.parkId),
          with_lulc: options.includeLandCover !== false,
          status: "Beklemede",
          requested_by: options.userId || null,
          note: options.note || "uygulama içi yayın",
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
