/* Preserve JSON values while preventing an HTML script element from closing. */
export function scriptSafeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,char=>
    '\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
}
