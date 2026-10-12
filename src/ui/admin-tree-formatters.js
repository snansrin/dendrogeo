"use strict";

window.DG_ADMIN_TREE_FORMATTERS = (() => {
  function tons(kg) { return (Number(kg || 0) / 1000).toFixed(2) + " t"; }
  function pendingBadge(count, translateCount) {
    if (!(count > 0)) return "";
    const title = translateCount ? translateCount("{n} kayıt onay bekliyor", { n: count }) : count + " kayıt onay bekliyor";
    return `<span class="dg-pend" title="${title}">🔴 ${count}</span>`;
  }
  function statusSummary(summary) {
    const parts = [];
    if (summary.onayli) parts.push(`<span class="dg-st-on">✓${summary.onayli}</span>`);
    if (summary.beklemede) parts.push(`<span class="dg-st-wait">⏳${summary.beklemede}</span>`);
    if (summary.red) parts.push(`<span class="dg-st-off">🚫${summary.red}</span>`);
    return parts.join(" ");
  }
  function badge(status, escape) {
    const color = status === "Onaylı" ? "on" : (status === "Red" ? "off" : "admin");
    const text = status === "Beklemede" ? "Onay Bekliyor" : status;
    return `<span class="badge ${color}">${escape(text)}</span>`;
  }
  return Object.freeze({ tons, pendingBadge, statusSummary, badge });
})();
