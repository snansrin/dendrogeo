import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/domain/parks/grid-bounds.js', import.meta.url), 'utf8'), context);

test('grid query bounds include all points from the outer ring and park holes', () => {
  const bounds = context.window.DG_GRID_BOUNDS.resolve([
    [[39.1, 32.6], [39.4, 32.9]],
    [[39.2, 32.7], [39.3, 32.8]]
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(bounds)), {
    minLat: 39.1, maxLat: 39.4, minLon: 32.6, maxLon: 32.9
  });
});
