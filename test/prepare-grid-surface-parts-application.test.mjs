import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/prepare-grid-surface-parts.js', import.meta.url), 'utf8'), context);
const prepareParts = context.window.DG_GRID_SURFACE_PARTS.prepare;

test('reviewed surface geometry takes precedence over the latest analysis cache', async () => {
  const parts = [{ class: 'green', geometry: {} }];
  let fallbackCalled = false;
  const result = await prepareParts({
    review: { record: {}, geometry: {} },
    lastCells: [{ id: 'cached' }],
    resolveReviewParts: () => parts,
    prepare: async () => { fallbackCalled = true; return { parts: [] }; }
  });
  assert.equal(result, parts);
  assert.equal(fallbackCalled, false);
});

test('latest analysis cells use the existing surface preparation contract', async () => {
  const lastCells = [{ id: 'cell-1' }];
  const outer = [[39, 32]];
  const holes = [[[39.1, 32.1]]];
  const osmElements = [{ id: 'osm-1' }];
  let received;
  const parts = [{ class: 'water', geometry: {} }];
  const result = await prepareParts({
    review: null,
    lastCells,
    outer,
    holes,
    epsg: 32636,
    osmElements,
    prepare: async options => { received = options; return { parts }; }
  });
  assert.equal(result, parts);
  assert.equal(received.cells, lastCells);
  assert.equal(received.outer, outer);
  assert.equal(received.holes, holes);
  assert.equal(received.epsg, 32636);
  assert.equal(received.objects, null);
  assert.equal(received.elements, osmElements);
  assert.deepEqual(JSON.parse(JSON.stringify(received.features)), []);
});

test('no review geometry or analyzed cells resolves to an empty parts list', async () => {
  let called = false;
  const result = await prepareParts({
    review: null,
    lastCells: [],
    prepare: async () => { called = true; return { parts: [1] }; }
  });
  assert.deepEqual(Array.from(result), []);
  assert.equal(called, false);
});
