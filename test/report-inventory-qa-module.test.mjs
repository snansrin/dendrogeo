import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryQa as moduleInventoryQa } from '../scripts/lib/report-inventory-qa.mjs';
import { inventoryQa as reportInventoryQa } from '../scripts/make-report.mjs';
import { loadSpeciesDict } from '../scripts/lib/mc.mjs';

test('make-report keeps the same inventory QA function as its extracted module', () => {
  assert.strictEqual(reportInventoryQa, moduleInventoryQa);
  const result = moduleInventoryQa([], loadSpeciesDict());
  assert.equal(result.n, 0);
  assert.equal(result.state, 'GECERLI');
});
