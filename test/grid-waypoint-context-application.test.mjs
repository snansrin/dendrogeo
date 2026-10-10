import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/is-grid-waypoint-context-current.js', import.meta.url), 'utf8'), context);
const isCurrent = context.window.DG_GRID_WAYPOINT_CONTEXT.isCurrent;
const park = {};
const base = {
  source: 'sig', park, projectId: 9,
  getReviewSignature: () => 'sig', getGridSource: () => 'sig', getPark: () => park, getProjectId: () => 9
};

test('accepts unchanged surface, grid, park, and project context', () => {
  assert.equal(isCurrent(base), true);
});

test('rejects each stale dimension', () => {
  assert.equal(isCurrent({ ...base, getReviewSignature: () => 'new-sig' }), false);
  assert.equal(isCurrent({ ...base, getGridSource: () => 'new-grid' }), false);
  assert.equal(isCurrent({ ...base, getPark: () => ({}) }), false);
  assert.equal(isCurrent({ ...base, getProjectId: () => 10 }), false);
});

test('checks contexts in order and stops at the first mismatch', () => {
  const calls = [];
  const result = isCurrent({
    ...base,
    getReviewSignature: () => { calls.push('signature'); return 'wrong'; },
    getGridSource: () => { calls.push('grid'); return 'sig'; },
    getPark: () => { calls.push('park'); return park; },
    getProjectId: () => { calls.push('project'); return 9; }
  });
  assert.equal(result, false);
  assert.deepEqual(calls, ['signature']);
});
