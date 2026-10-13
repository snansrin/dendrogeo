"use strict";

/* Encode campaign rows as the existing spreadsheet-friendly UTF-8 CSV. */
window.DG_SERIALIZE_VALIDATION_CAMPAIGN_CSV={
  serialize(rows){return"\uFEFF"+rows.map(row=>row.join(",")).join("\n")+"\n";}
};
