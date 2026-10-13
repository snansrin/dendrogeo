"use strict";

/* Keep schema fallback separate from authorization and transient read failures. */
window.DG_RESOLVE_PARK_COMPARISON_READ={
 resolve(error,isSchemaError){
  if(!error)return"primary";
  return isSchemaError(error)?"legacy":"denied";
 }
};
