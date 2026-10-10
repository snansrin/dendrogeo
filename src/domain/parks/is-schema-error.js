"use strict";

/* Classify actual Postgres/PostgREST schema-missing errors only. */
window.DG_PARK_SCHEMA_CAPABILITY = Object.freeze({
  isSchemaError(err) {
    const code=String((err&&(err.code||err.status))||"");
    const message=String((err&&err.message)||err||"");
    if(/^(42P01|42703|42883)$/.test(code))return true;
    if(/PGRST205|PGRST202/.test(message)||/PGRST205|PGRST202/.test(code))return true;
    return /does not exist|could not find the (table|view)|42P01|42703/i.test(message);
  }
});
