import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_CSV_HEADER, reportMeasurementsCsv, reportMeasurementsGeoJson } from '../scripts/lib/report-export.mjs';

const row = {
  point_id: 1, species: 'SÜS ERİĞİ', grp: 'YAPRAKLI', girth_cm: 56.8, dbh_cm: 18.08,
  height_m: 4.6, carbon_kg: 123.45, lat: 0, lon: 0, acc_m: null, date: '2026-10-01',
};

test('report CSV keeps the published header, BOM, row order and one-decimal DBH presentation', () => {
  assert.equal(REPORT_CSV_HEADER, 'NOKTA,TUR,GRUP,GOGUS_CEVRESI_CM,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH');
  const csv = reportMeasurementsCsv({ rows: [row] }, () => ({ lo: 100.04, hi: 146.66 }));
  assert.equal(csv, '\uFEFF' + REPORT_CSV_HEADER + '\n1,"SÜS ERİĞİ",YAPRAKLI,56.8,18.1,4.6,123.45,100.0,146.7,0,0,,2026-10-01\n');
});

test('report GeoJSON keeps [longitude, latitude], known properties and null for invalid DBH', () => {
  const invalid = { ...row, point_id: 2, dbh_cm: undefined };
  const result = reportMeasurementsGeoJson({ rows: [row, invalid] });
  assert.equal(result.type, 'FeatureCollection');
  assert.deepEqual(result.features[0], {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { nokta: 1, tur: 'SÜS ERİĞİ', grup: 'YAPRAKLI', gogus_cevresi_cm: 56.8, dbh_cm: 18.1, boy_m: 4.6, karbon_kg: 123.45, tarih: '2026-10-01' },
  });
  assert.equal(result.features[1].properties.dbh_cm, null);
  assert.equal(row.dbh_cm, 18.08, 'serializer must not modify the accepted snapshot');
});
