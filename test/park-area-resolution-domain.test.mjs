import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/domain/parks/resolve-park-area.js', import.meta.url), 'utf8'), context);
const area = context.window.DG_PARK_AREA_RESOLUTION;

test('a finite positive selected park area remains authoritative', () => {
  let calls = 0;
  const result = area.resolveAreaM2(1234.5, [[1, 2]], [], () => { calls++; return 999; });
  assert.equal(result, 1234.5);
  assert.equal(calls, 0);
});

test('missing or invalid selected area falls back to polygon area with holes', () => {
  const outer = [[39, 32], [39, 32.01], [39.01, 32.01]];
  const holes = [[[39.002, 32.002], [39.003, 32.002], [39.003, 32.003]]];
  let input;
  const result = area.resolveAreaM2(NaN, outer, holes, rings => { input = rings; return 9876; });
  assert.equal(result, 9876);
  assert.equal(input.outer, outer);
  assert.equal(input.inner, holes);
  assert.equal(area.resolveAreaM2(0, null, holes, () => 9876), 0);
});

test('square meters convert to hectares using the existing 10,000 divisor', () => {
  assert.equal(area.hectaresFromSquareMeters(12500), 1.25);
});
