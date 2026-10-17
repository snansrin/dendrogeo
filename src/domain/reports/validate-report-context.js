"use strict";

(function (root) {
  function validate(input,today) {
    const value = root.DG_CLEAN_REPORT_CONTEXT.clean(input);
    const errors = {};
    if (value.inventory_scope && !['census', 'partial', 'probability_sample'].includes(value.inventory_scope)) {
      errors.inventory_scope = "Geçerli envanter kapsamı seçin.";
    }
    // Bibliographic fields are optional; validate only information that is supplied.
    for (const key of ["start_date", "end_date"]) {
      const date = value[key];
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
        || new Date(date).toISOString().slice(0, 10) !== date)) errors[key] = "Geçerli saha tarihi girin.";
    }
    if (value.start_date && value.end_date
      && !/^\d{4}-\d{2}-\d{2}$/.test(today)) throw TypeError("Künye tarih doğrulaması açık today girdisi gerektirir.");
    if (value.start_date && value.end_date
      && (value.end_date < value.start_date || value.end_date > today)) {
      errors.end_date = "Saha tarih aralığı geçersiz.";
    }
    if (!root.DG_REPORT_ORCID_DOMAIN.valid(value.orcid)) errors.orcid = "ORCID kimliğinin biçimini ve kontrol basamağını denetleyin.";
    return { value, errors, valid: !Object.keys(errors).length };
  }

  root.DG_VALIDATE_REPORT_CONTEXT = Object.freeze({ validate });
})(globalThis);
