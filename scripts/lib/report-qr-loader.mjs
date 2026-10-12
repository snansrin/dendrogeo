/* QR is optional at report-build time; unavailable packages must not block publication. */
export function loadOptionalReportQr(resolvePackage) {
  try { return resolvePackage('qrcode'); }
  catch { return null; }
}
