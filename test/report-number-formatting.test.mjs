import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReportNumber, formatReportTonnesFromKg } from '../scripts/lib/report-formatting.mjs';

test('report number formatting keeps Turkish locale and fixed precision', () => {
  assert.equal(formatReportNumber(1234.5), '1.234,50');
  assert.equal(formatReportNumber(1234.5, 0), '1.235');
  assert.equal(formatReportNumber(-12.3, 1), '-12,3');
});


test('kilogram-to-tonne report display keeps the existing conversion and precision', () => {
  assert.equal(formatReportTonnesFromKg(12345.67), '12,35');
  assert.equal(formatReportTonnesFromKg(500), '0,50');
});
