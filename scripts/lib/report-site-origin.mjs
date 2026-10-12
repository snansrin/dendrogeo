/* Resolve the report site's existing CNAME value with its established fallback. */
export function resolveReportSiteOrigin(read) {
  try {
    const cname = read('CNAME').trim();
    return cname ? 'https://' + cname : 'https://dendrogeo.org';
  } catch (error) {
    return 'https://dendrogeo.org';
  }
}
