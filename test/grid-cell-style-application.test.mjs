import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/resolve-grid-cell-style.js', import.meta.url), 'utf8'), context);
const resolve = context.window.DG_GRID_CELL_STYLE.resolve;

test('empty and measured cells retain their existing unselected styles', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({ n: 0 }))), {
    color: '#e11d48', weight: 1.2, fillColor: '#e11d48', fillOpacity: 0.32
  });
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({ n: 4 }))), {
    color: '#16a34a', weight: 1.2, fillColor: '#16a34a', fillOpacity: 0.32
  });
});

test('selected style is independent of measurement count', () => {
  const expected = { color: '#1d4ed8', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.55 };
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({ n: 0 }, true))), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({ n: 8 }, true))), expected);
});
