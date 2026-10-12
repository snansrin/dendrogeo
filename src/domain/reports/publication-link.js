"use strict";

window.DG_REPORT_PUBLICATION_LINK = (() => {
  const REPORT_ID = /^DGR-\d{4}-\d{4}$/;

  function isReportId(value) {
    return REPORT_ID.test(String(value || ""));
  }

  function url(value, origin = "https://dendrogeo.org") {
    return isReportId(value) ? origin + "/rapor/" + value + "/" : "";
  }

  return Object.freeze({ isReportId, url });
})();
