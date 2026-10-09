import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReportMeasurements } from '../scripts/lib/report-measurement-summary.mjs';

const rows = [
  { species: 'MEŞE', grp: 'YAPRAKLI', carbon_kg: '10.2', dbh_cm: '20', height_m: '5', accuracy_m: '4', created_at: '2026-02-01', reviewed_at: '2026-02-03' },
  { species: 'ÇAM', grp: 'İBRELİ', carbon_kg: 3.5, dbh_cm: 10, height_m: 4, accuracy_m: 0, created_at: '2026-01-01', reviewed_at: null },
  { species: 'MEŞE', grp: 'YAPRAKLI', carbon_kg: 20.3, dbh_cm: 40, height_m: 10, accuracy_m: 8, created_at: '2026-03-01', reviewed_at: '2026-03-02' },
  { species: 'MEŞE', grp: 'YAPRAKLI', carbon_kg: 1, dbh_cm: 12, height_m: 4, accuracy_m: -1, created_at: '2026-04-01', reviewed_at: '' },
];

test('report summary: preserves carbon, CI, species ordering, precision and sample weighting', () => {
  const sample = rows.slice(0, 3);
  const rowCiCalls = [];
  const summary = summarizeReportMeasurements(sample, 10000, {
    mcTotalCI: (input) => { assert.equal(input, sample); return { mean: 34.123, lo: 12.345, hi: 44.444 }; },
    mcRowCI: (row) => { rowCiCalls.push(row.species); return null; },
  });

  assert.deepEqual(summary.totals, {
    n: 3, carbon_kg: 34, ci: { mean: 34.12, lo: 12.35, hi: 44.44 }, per_ha_kg: 34,
  });
  assert.deepEqual(summary.species, [
    { species: 'MEŞE', grp: 'YAPRAKLI', n: 2, mean_dbh: 30, mean_h: 7.5, carbon_kg: 30.5, share_pct: 89.7 },
    { species: 'ÇAM', grp: 'İBRELİ', n: 1, mean_dbh: 10, mean_h: 4, carbon_kg: 3.5, share_pct: 10.3 },
  ]);
  assert.deepEqual(rowCiCalls, ['MEŞE', 'ÇAM']);
  assert.deepEqual(summary.gps, { n: 3, n_with_acc: 2, n_null_acc: 1, mean_acc_m: 6 });
  assert.deepEqual(summary.period, { from: '2026-01-01', to: '2026-03-01' });
  assert.deepEqual(summary.moderation, { approved: 3, reviewed: 2 });
});

test('report summary: zero park area remains null and nonpositive accuracy is not counted', () => {
  const summary = summarizeReportMeasurements([rows[3]], 0, {
    mcTotalCI: () => ({ mean: 1, lo: 0.5, hi: 1.5 }),
    mcRowCI: () => null,
  });
  assert.equal(summary.totals.per_ha_kg, null);
  assert.deepEqual(summary.gps, { n: 1, n_with_acc: 0, n_null_acc: 1, mean_acc_m: null });
  assert.deepEqual(summary.moderation, { approved: 1, reviewed: 0 });
});
