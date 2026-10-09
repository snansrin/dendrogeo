import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as moduleFormatters from '../scripts/lib/report-formatting.mjs';
import * as reportApi from '../scripts/make-report.mjs';

test('make-report preserves each report formatting API through the extracted module', () => {
  for (const name of ['citeName', 'fmtDateTr', 'fmtDateDot', 'epsgLabel'])
    assert.strictEqual(reportApi[name], moduleFormatters[name], `${name} API identity`);
  assert.equal(moduleFormatters.citeName('Nagihan Şirin'), 'Şirin, N.');
  assert.equal(moduleFormatters.fmtDateTr('2026-09-28T12:00:00Z'), '28 Eylül 2026');
  assert.equal(moduleFormatters.fmtDateDot('2026-09-28T12:00:00Z'), '28.09.2026');
  assert.equal(moduleFormatters.epsgLabel(32636), 'EPSG:32636 (UTM 36N)');
});
