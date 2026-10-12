import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReportNumber } from '../scripts/lib/report-formatting.mjs';

test('report number formatting keeps Turkish locale and fixed precision', () => {
  assert.equal(formatReportNumber(1234.5), '1.234,50');
  assert.equal(formatReportNumber(1234.5, 0), '1.235');
  assert.equal(formatReportNumber(-12.3, 1), '-12,3');
});
