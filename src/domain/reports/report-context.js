"use strict";

(function (root) {
  const fields = Object.freeze({
    author_name: 120, institution: 180, department: 180, program: 120, advisor: 180,
    orcid: 19, project_name: 240, title: 300, purpose: 1600, study_type: 60,
    funding: 300, sampling: 1600, instruments: 1000, start_date: 10, end_date: 10,
    inventory_scope: 24, observers: 300, calibration: 1200, repeat_measurements: 1200,
  });
  root.DG_REPORT_CONTEXT_FIELDS = fields;
  root.DG_REPORT_CONTEXT_DOMAIN = Object.freeze({
    fields,
    clean: root.DG_CLEAN_REPORT_CONTEXT.clean,
    validate: root.DG_VALIDATE_REPORT_CONTEXT.validate,
    orcidValid: root.DG_REPORT_ORCID_DOMAIN.valid,
    normalizeOrcid: root.DG_REPORT_ORCID_DOMAIN.normalize,
    decode: root.DG_DECODE_REPORT_CONTEXT.decode,
  });
})(globalThis);
