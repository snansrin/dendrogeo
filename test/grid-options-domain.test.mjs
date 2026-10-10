import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/domain/parks/grid-options.js', import.meta.url), 'utf8'), context);
const resolve = context.window.DG_GRID_OPTIONS.resolve;

test('grid options preserve the 20 m and 3 m defaults for empty, zero, and invalid inputs', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('', ''))), { size: 20, clearance: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('0', '0'))), { size: 20, clearance: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('bad', 'bad'))), { size: 20, clearance: 3 });
});

test('grid clearance stays between one and twenty while grid size remains numeric', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('12.5', '-4'))), { size: 12.5, clearance: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('8', '24'))), { size: 8, clearance: 20 });
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('6', '4.25'))), { size: 6, clearance: 4.25 });
});
