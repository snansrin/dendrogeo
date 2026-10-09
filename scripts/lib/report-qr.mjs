/* QR renderer adapter. Missing or failing QR support must not block reports. */
export function createQrDataUri(qrLibrary) {
  return async function qrDataUri(url) {
    try {
      const svg = await qrLibrary.toString(String(url), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 104, color: { dark: '#182420', light: '#ffffff' } });
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (error) { return null; }
  };
}
