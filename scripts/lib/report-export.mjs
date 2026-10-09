/* Pure CSV / GeoJSON serialization for the immutable report snapshot.
 * Geometry ordering and CSV header are part of the publication contract. */
export const REPORT_CSV_HEADER = 'NOKTA,TUR,GRUP,GOGUS_CEVRESI_CM,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH';

export function reportMeasurementsCsv(snap, rowConfidenceInterval) {
  const lines = snap.rows.map((r) => {
    const ci = rowConfidenceInterval(r);
    return [r.point_id, `"${r.species}"`, r.grp, r.girth_cm ?? '', Number.isFinite(+r.dbh_cm) ? (+r.dbh_cm).toFixed(1) : '', r.height_m, r.carbon_kg, ci.lo.toFixed(1), ci.hi.toFixed(1), r.lat, r.lon, r.acc_m ?? '', r.date].join(',');
  });
  return '\uFEFF' + REPORT_CSV_HEADER + '\n' + lines.join('\n') + '\n';
}

export function reportMeasurementsGeoJson(snap) {
  return { type: 'FeatureCollection', features: snap.rows.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { nokta: r.point_id, tur: r.species, grup: r.grp, gogus_cevresi_cm: r.girth_cm, dbh_cm: Number.isFinite(+r.dbh_cm) ? +(+r.dbh_cm).toFixed(1) : null, boy_m: r.height_m, karbon_kg: r.carbon_kg, tarih: r.date } })) };
}
