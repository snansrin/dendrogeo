import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/build-grid-request.js', import.meta.url), 'utf8'), context);
const build = context.window.DG_GRID_REQUEST.build;

test('resolved surface parts replace legacy water and impervious blockers', () => {
  const part = { type: 'green', geom: { type: 'Polygon' }, extra: 'not copied' };
  const request = build({
    size: 20, clearance: 3, epsg: 32636, outer: ['outer'], holes: ['hole'], greenOnly: true,
    parts: [part], waterRings: ['water-ring'], imperviousRings: ['hard-ring'],
    waterLines: ['water-line'], imperviousLines: ['hard-line'], gridBlockLines: ['path-line']
  });
  assert.deepEqual(Object.keys(request), ['job', 'size', 'clearance', 'epsg', 'outer', 'holes', 'greenOnly', 'parts', 'blockRings', 'blockLines']);
  assert.equal(request.parts[0].type, 'green');
  assert.equal(request.parts[0].geom, part.geom);
  assert.deepEqual(Array.from(request.blockRings), []);
  assert.equal(request.blockLines.length, 3);
  assert.equal(request.blockLines[0].pts, 'water-line');
  assert.equal(request.blockLines[0].w, 1);
  assert.equal(request.blockLines[1], 'hard-line');
  assert.equal(request.blockLines[2], 'path-line');
});

test('without resolved surface parts the worker receives legacy ring blockers', () => {
  const water = [[1, 2]], hard = [[3, 4]];
  const request = build({
    size: 10, clearance: 1, epsg: 32636, outer: [], greenOnly: false,
    waterRings: [water], imperviousRings: [hard], waterLines: [], imperviousLines: [], gridBlockLines: []
  });
  assert.equal(request.job, 'grid');
  assert.deepEqual(Array.from(request.holes), []);
  assert.deepEqual(Array.from(request.blockRings), [water, hard]);
  assert.deepEqual(Array.from(request.parts), []);
});
