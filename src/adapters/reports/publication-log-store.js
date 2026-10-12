"use strict";

window.DG_REPORT_PUBLICATION_LOG_STORE = (() => {
  async function load({ fetch: fetcher, url, now = Date.now } = {}) {
    try {
      const response = await fetcher(url + "?_=" + now(), { cache: "no-store" });
      if (!response.ok) return null;
      const value = await response.json();
      return value && Array.isArray(value.entries) ? value : null;
    } catch (_error) {
      return null;
    }
  }

  return Object.freeze({ load });
})();
