"use strict";
/* Compatibility bridge: report rules live in domain/reports/report-context.js. */
if(!globalThis.DG_REPORT_CONTEXT_DOMAIN)throw new Error("Rapor künye domain modülü yüklenmedi.");
globalThis.DG_REPORT_CONTEXT=Object.freeze({...globalThis.DG_REPORT_CONTEXT_DOMAIN,
 validate:input=>globalThis.DG_REPORT_CONTEXT_DOMAIN.validate(input,new Date().toISOString().slice(0,10)),
 decode:note=>globalThis.DG_REPORT_CONTEXT_DOMAIN.decode(note,new Date().toISOString().slice(0,10))
});
