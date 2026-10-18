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

test('green-only mode keeps legacy ring and line exclusions when no resolved parts exist', () => {
  const water = [[1, 2]], hard = [[3, 4]];
  const request = build({
    size: 10, clearance: 1, epsg: 32636, outer: [], greenOnly: true,
    waterRings: [water], imperviousRings: [hard], waterLines: [], imperviousLines: [], gridBlockLines: []
  });
  assert.equal(request.job, 'grid');
  assert.deepEqual(Array.from(request.holes), []);
  assert.deepEqual(Array.from(request.blockRings), [water, hard]);
  assert.deepEqual(Array.from(request.parts), []);
});

test('whole-park mode passes no water, road, or hard-surface blockers to grid generation', () => {
  const request = build({
    size: 20, clearance: 3, epsg: 32636, outer: ['park'], greenOnly: false,
    parts: [{ type: 'green', geom: ['green'] }, { type: 'hard', geom: ['road'] }],
    waterRings: ['water-ring'], imperviousRings: ['hard-ring'],
    waterLines: ['water-line'], imperviousLines: [{ pts: 'road-line', w: 4 }], gridBlockLines: ['path-line']
  });
  assert.deepEqual(Array.from(request.blockRings), []);
  assert.deepEqual(Array.from(request.blockLines), []);
  assert.equal(request.greenOnly, false);
  assert.equal(request.parts.length, 2, 'source evidence is retained without excluding whole-park cells');
});
