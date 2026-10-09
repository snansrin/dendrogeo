"use strict";
/* Compatibility bridge: report rules live in domain/reports/report-context.js. */
if(!globalThis.DG_REPORT_CONTEXT_DOMAIN)throw new Error("Rapor künye domain modülü yüklenmedi.");
globalThis.DG_REPORT_CONTEXT=globalThis.DG_REPORT_CONTEXT_DOMAIN;
