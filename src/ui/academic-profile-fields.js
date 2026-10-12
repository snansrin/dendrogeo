"use strict";

window.DG_ACADEMIC_PROFILE_FIELDS = (() => {
  function label(key, text, required, examples, escape) {
    const example = examples[key];
    return '<span class="dg-field-label"><span class="lbl">' + escape(text) + (required ? ' *' : '') + '</span>'
      + (example ? '<span class="dg-field-help" tabindex="0" role="note" aria-label="' + escape(example) + '" data-tip="' + escape(example) + '">?</span>' : '') + '</span>';
  }

  function input(key, text, value, required, ports) {
    const example = ports.examples[key] || '';
    return '<label class="dg-academic-field">' + label(key, text, required, ports.examples, ports.escape)
      + '<input name="' + key + '" value="' + ports.escape(value || '') + '" maxlength="'
      + (key === 'orcid' ? 80 : ports.fields[key]) + '" ' + (required ? 'required' : '')
      + ' placeholder="' + ports.escape(example) + '" ' + (key === 'orcid' ? 'inputmode="text"' : '') + '></label>';
  }

  return Object.freeze({ label, input });
})();
