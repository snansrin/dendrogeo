/* Pure locale and citation formatters shared by report rendering and metadata. */

/* Yazar/ad biçimleme (0012): "Ad Soyad" → "Soyad, A." (atıf düzeni).
 * Tek kelimeli adlar olduğu gibi kalır; virgüllü adlar zaten atıf biçimindedir. */
export function citeName(full) {
  const t = String(full || '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.includes(',')) return t;
  const ps = t.split(' ');
  if (ps.length < 2) return t;
  const soy = ps[ps.length - 1];
  const ad = ps.slice(0, -1).join(' ');
  return soy + ', ' + ad.charAt(0) + '.';
}

export function fmtDateTr(iso, tz = 'UTC') {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }); }
  catch (e) { return String(iso || '').slice(0, 10); }
}

export function fmtDateDot(iso) {
  try {
    const d = new Date(iso);
    return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
  } catch (e) { return '—'; }
}

export function epsgLabel(epsg) {
  const n = Number(epsg);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 4326) return 'EPSG:4326 (WGS 84 coğrafi)';
  if (n >= 32601 && n <= 32660) return `EPSG:${n} (UTM ${n - 32600}N)`;
  return 'EPSG:' + n;
}
