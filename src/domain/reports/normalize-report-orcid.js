"use strict";

(function (root) {
  function normalize(value) {
    const raw = String(value || "").trim();
    const compact = raw.replace(/^https?:\/\/orcid\.org\//i, "").replace(/[\s-]/g, "").toUpperCase();
    return /^\d{15}[\dX]$/.test(compact) ? compact.match(/.{4}/g).join("-") : raw;
  }

  function valid(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value)) return false;
    const compact = value.replace(/-/g, "");
    const check = (12 - [...compact.slice(0, 15)].reduce((sum, digit) => (sum + Number(digit)) * 2, 0) % 11) % 11;
    return compact.at(-1) === (check === 10 ? "X" : String(check));
  }

  root.DG_REPORT_ORCID_DOMAIN = Object.freeze({ normalize, valid });
})(globalThis);
