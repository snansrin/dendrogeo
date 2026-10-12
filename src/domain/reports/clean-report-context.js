"use strict";

(function (root) {
  function clean(input) {
    const fields = root.DG_REPORT_CONTEXT_FIELDS;
    const out = {};
    for (const [key, max] of Object.entries(fields)) {
      const value = input?.[key];
      out[key] = typeof value === "string"
        ? (key === "orcid" ? root.DG_REPORT_ORCID_DOMAIN.normalize(value) : value)
          .replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
        : "";
    }
    out.independent = input?.independent === true;
    return out;
  }

  root.DG_CLEAN_REPORT_CONTEXT = Object.freeze({ clean });
})(globalThis);
