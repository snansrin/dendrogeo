"use strict";

/* Keep the versioned campaign export schema and pretty-print contract. */
window.DG_SERIALIZE_VALIDATION_CAMPAIGN_JSON={
  serialize(campaign,version){return JSON.stringify(Object.assign({schema:"dendrogeo-lc-validation/1",validateVersion:version},campaign),null,1);}
};
